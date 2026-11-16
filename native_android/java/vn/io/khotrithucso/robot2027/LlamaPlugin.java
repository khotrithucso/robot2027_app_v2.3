package vn.io.khotrithucso.robot2027;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "LlamaLocal")
public class LlamaPlugin extends Plugin {
    static {
        System.loadLibrary("robot_llama");
    }

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private volatile boolean isLoaded = false;
    private String currentModelId = "";

    private native boolean nativeLoadModel(String modelPath, int nThreads);
    private native String nativeGenerate(String prompt, int maxTokens);
    private native void nativeUnload();

    private File getModelsDir() {
        File dir = new File(getContext().getFilesDir(), "models");
        if (!dir.exists()) {
            dir.mkdirs();
        }
        return dir;
    }

    private boolean isValidGgufHeader(File file) {
        if (!file.exists() || file.length() < 1024 * 1024) return false;
        try (FileInputStream fis = new FileInputStream(file)) {
            byte[] magic = new byte[4];
            if (fis.read(magic) < 4) return false;
            return magic[0] == 'G' && magic[1] == 'G' && magic[2] == 'U' && magic[3] == 'F';
        } catch (Exception e) {
            return false;
        }
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("loaded", isLoaded);
        ret.put("modelId", currentModelId);
        call.resolve(ret);
    }

    @PluginMethod
    public void downloadAndLoad(PluginCall call) {
        final String urlStr = call.getString("url", "");
        final String fileName = call.getString("fileName", "model.gguf");
        final String modelId = call.getString("modelId", "SMOLLM2");
        final int threads = call.getInt("threads", 4);

        if (urlStr.isEmpty()) {
            call.reject("Thiếu đường dẫn tải model (url)");
            return;
        }

        executor.execute(() -> {
            try {
                File targetFile = new File(getModelsDir(), fileName);
                File tempFile = new File(getModelsDir(), fileName + ".part");

                if (!isValidGgufHeader(targetFile)) {
                    if (targetFile.exists()) targetFile.delete();
                    if (tempFile.exists()) tempFile.delete();

                    String currentUrl = urlStr;
                    HttpURLConnection conn = null;
                    int redirects = 0;

                    while (redirects < 6) {
                        URL url = new URL(currentUrl);
                        conn = (HttpURLConnection) url.openConnection();
                        conn.setInstanceFollowRedirects(false);
                        conn.setConnectTimeout(20000);
                        conn.setReadTimeout(30000);
                        conn.setRequestProperty("User-Agent", "Robot2027-Android/2.3");

                        int code = conn.getResponseCode();
                        if (code == HttpURLConnection.HTTP_MOVED_PERM ||
                            code == HttpURLConnection.HTTP_MOVED_TEMP ||
                            code == 307 || code == 308) {
                            currentUrl = conn.getHeaderField("Location");
                            conn.disconnect();
                            redirects++;
                        } else {
                            break;
                        }
                    }

                    if (conn == null || conn.getResponseCode() >= 400) {
                        int code = conn != null ? conn.getResponseCode() : 0;
                        call.reject("Lỗi HTTP tải model (" + code + "). Hãy kiểm tra mạng hoặc link Hugging Face.");
                        return;
                    }

                    long totalBytes = conn.getContentLengthLong();
                    long downloaded = 0;
                    long lastEmit = 0;

                    try (InputStream in = new BufferedInputStream(conn.getInputStream(), 65536);
                         FileOutputStream out = new FileOutputStream(tempFile)) {
                        byte[] buffer = new byte[65536];
                        int read;
                        while ((read = in.read(buffer)) != -1) {
                            out.write(buffer, 0, read);
                            downloaded += read;
                            long now = System.currentTimeMillis();
                            if (now - lastEmit > 350) {
                                lastEmit = now;
                                JSObject prog = new JSObject();
                                prog.put("downloaded", downloaded);
                                prog.put("total", totalBytes);
                                prog.put("percent", totalBytes > 0 ? (int)((downloaded * 100) / totalBytes) : 0);
                                notifyListeners("downloadProgress", prog);
                            }
                        }
                        out.flush();
                    }
                    conn.disconnect();

                    if (!isValidGgufHeader(tempFile)) {
                        tempFile.delete();
                        call.reject("File tải về không đúng định dạng chuẩn GGUF (có thể bị chặn mạng).");
                        return;
                    }

                    if (targetFile.exists()) targetFile.delete();
                    tempFile.renameTo(targetFile);
                }

                JSObject loadProg = new JSObject();
                loadProg.put("percent", 100);
                loadProg.put("stage", "loading_ram");
                notifyListeners("downloadProgress", loadProg);

                boolean ok = nativeLoadModel(targetFile.getAbsolutePath(), threads);
                if (!ok) {
                    isLoaded = false;
                    // Xóa file hỏng/không tương thích để lần sau chọn model khác sạch sẽ
                    targetFile.delete();
                    call.reject("llama.cpp không nạp được GGUF này (CPU không hỗ trợ định dạng lượng tử này). Hãy chọn bản Q4_0 hoặc Q4_K_M!");
                    return;
                }

                isLoaded = true;
                currentModelId = modelId;

                JSObject res = new JSObject();
                res.put("loaded", true);
                res.put("modelId", modelId);
                res.put("sizeMB", Math.round((targetFile.length() / (1024.0 * 1024.0)) * 10.0) / 10.0);
                call.resolve(res);
            } catch (Exception e) {
                isLoaded = false;
                call.reject("Lỗi tải/nạp model: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void generate(PluginCall call) {
        final String prompt = call.getString("prompt", "");
        final int maxTokens = call.getInt("maxTokens", 28);

        if (!isLoaded) {
            call.reject("Model chưa được nạp vào RAM.");
            return;
        }

        executor.execute(() -> {
            long t0 = System.currentTimeMillis();
            String output = nativeGenerate(prompt, maxTokens);
            long elapsed = System.currentTimeMillis() - t0;

            JSObject res = new JSObject();
            res.put("text", output != null ? output.trim() : "");
            res.put("ms", elapsed);
            call.resolve(res);
        });
    }

    @PluginMethod
    public void deleteModels(PluginCall call) {
        executor.execute(() -> {
            nativeUnload();
            isLoaded = false;
            currentModelId = "";
            File dir = getModelsDir();
            File[] files = dir.listFiles();
            if (files != null) {
                for (File f : files) f.delete();
            }
            call.resolve();
        });
    }
}
