#include <jni.h>
#include <string>
#include <vector>
#include <cstring>
#include <android/log.h>
#include "llama.h"

#define LOG_TAG "RobotLlamaJNI"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

static llama_model * g_model = nullptr;
static llama_context * g_ctx = nullptr;
static llama_sampler * g_sampler = nullptr;

static void free_all() {
    if (g_sampler) {
        llama_sampler_free(g_sampler);
        g_sampler = nullptr;
    }
    if (g_ctx) {
        llama_free(g_ctx);
        g_ctx = nullptr;
    }
    if (g_model) {
        llama_model_free(g_model);
        g_model = nullptr;
    }
}

extern "C" JNIEXPORT jboolean JNICALL
Java_vn_io_khotrithucso_robot2027_LlamaPlugin_nativeLoadModel(
        JNIEnv * env,
        jobject /* this */,
        jstring jModelPath,
        jint nThreads) {
    const char * modelPath = env->GetStringUTFChars(jModelPath, nullptr);
    LOGI("Loading GGUF model: %s", modelPath);

    free_all();
    llama_backend_init();

    llama_model_params mparams = llama_model_default_params();
    mparams.use_mmap = true;
    mparams.use_mlock = false;

    g_model = llama_model_load_from_file(modelPath, mparams);
    env->ReleaseStringUTFChars(jModelPath, modelPath);

    if (!g_model) {
        LOGE("Failed to load GGUF model!");
        return JNI_FALSE;
    }

    int threads = (nThreads > 0 && nThreads <= 6) ? nThreads : 4;

    llama_context_params cparams = llama_context_default_params();
    cparams.n_ctx = 384;      // Gọn nhẹ giúp giảm 60% thời gian prefill trên mobile
    cparams.n_batch = 128;
    cparams.n_ubatch = 128;
    cparams.n_threads = threads;
    cparams.n_threads_batch = threads;

    g_ctx = llama_init_from_model(g_model, cparams);
    if (!g_ctx) {
        LOGE("Failed to create llama_context!");
        free_all();
        return JNI_FALSE;
    }

    auto sparams = llama_sampler_chain_default_params();
    g_sampler = llama_sampler_chain_init(sparams);
    llama_sampler_chain_add(g_sampler, llama_sampler_init_top_k(24));
    llama_sampler_chain_add(g_sampler, llama_sampler_init_top_p(0.88f, 1));
    llama_sampler_chain_add(g_sampler, llama_sampler_init_temp(0.65f));
    llama_sampler_chain_add(g_sampler, llama_sampler_init_dist(LLAMA_DEFAULT_SEED));

    LOGI("Model loaded & ready with %d threads!", threads);
    return JNI_TRUE;
}

extern "C" JNIEXPORT jstring JNICALL
Java_vn_io_khotrithucso_robot2027_LlamaPlugin_nativeGenerate(
        JNIEnv * env,
        jobject /* this */,
        jstring jPrompt,
        jint maxTokens) {
    if (!g_model || !g_ctx || !g_sampler) {
        return env->NewStringUTF("");
    }

    const char * promptCStr = env->GetStringUTFChars(jPrompt, nullptr);
    std::string prompt(promptCStr);
    env->ReleaseStringUTFChars(jPrompt, promptCStr);

    // Bản llama.cpp b4600 dùng llama_kv_cache_clear thay cho llama_kv_self_clear
    llama_kv_cache_clear(g_ctx);
    llama_sampler_reset(g_sampler);

    const llama_vocab * vocab = llama_model_get_vocab(g_model);

    std::vector<llama_token> tokens(prompt.size() + 32);
    int n_tokens = llama_tokenize(
        vocab,
        prompt.c_str(),
        (int32_t)prompt.size(),
        tokens.data(),
        (int32_t)tokens.size(),
        true,
        true
    );

    if (n_tokens < 0) {
        tokens.resize(-n_tokens);
        n_tokens = llama_tokenize(
            vocab,
            prompt.c_str(),
            (int32_t)prompt.size(),
            tokens.data(),
            (int32_t)tokens.size(),
            true,
            true
        );
    }
    if (n_tokens <= 0) {
        return env->NewStringUTF("");
    }
    tokens.resize(n_tokens);

    int max_ctx = (int)llama_n_ctx(g_ctx);
    if (n_tokens > max_ctx - 40) {
        int keep = max_ctx - 40;
        tokens.erase(tokens.begin(), tokens.begin() + (n_tokens - keep));
        n_tokens = keep;
    }

    llama_batch batch = llama_batch_get_one(tokens.data(), n_tokens);
    if (llama_decode(g_ctx, batch) != 0) {
        LOGE("llama_decode failed on prompt!");
        return env->NewStringUTF("");
    }

    std::string result;
    int limit = (maxTokens > 0 && maxTokens <= 64) ? maxTokens : 28;
    int generated = 0;

    while (generated < limit) {
        llama_token new_token = llama_sampler_sample(g_sampler, g_ctx, -1);

        if (llama_vocab_is_eog(vocab, new_token)) {
            break;
        }

        char buf[128];
        int n = llama_token_to_piece(vocab, new_token, buf, sizeof(buf), 0, true);
        if (n > 0) {
            result.append(buf, n);
        }

        // Dừng sớm ngay khi gặp thẻ kết thúc ChatML hoặc xuống dòng
        if (result.find("<|im_end|>") != std::string::npos ||
            result.find("<|endoftext|>") != std::string::npos ||
            result.find("</s>") != std::string::npos ||
            result.find("\n") != std::string::npos) {
            break;
        }

        // Dừng ngay khi hoàn thành trọn 1 câu ngắn (>= 18 ký tự và kết thúc bằng . ! ?)
        if (result.size() >= 18) {
            char last = result.back();
            if (last == '.' || last == '!' || last == '?') {
                break;
            }
        }

        llama_batch next_batch = llama_batch_get_one(&new_token, 1);
        if (llama_decode(g_ctx, next_batch) != 0) {
            break;
        }
        generated++;
    }

    // Làm sạch thẻ thừa nếu có
    const char * stopTags[] = {"<|im_end|>", "<|endoftext|>", "</s>", "<|im_start|>"};
    for (const char * tag : stopTags) {
        size_t pos = result.find(tag);
        if (pos != std::string::npos) {
            result = result.substr(0, pos);
        }
    }

    return env->NewStringUTF(result.c_str());
}

extern "C" JNIEXPORT void JNICALL
Java_vn_io_khotrithucso_robot2027_LlamaPlugin_nativeUnload(
        JNIEnv * /* env */,
        jobject /* this */) {
    free_all();
}
