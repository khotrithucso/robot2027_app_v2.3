package vn.io.khotrithucso.robot2027;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;
import java.util.Locale;
import java.util.UUID;

@CapacitorPlugin(
    name = "SpeechBridge",
    permissions = {
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO })
    }
)
public class SpeechBridgePlugin extends Plugin {
    private TextToSpeech tts;
    private boolean ttsReady = false;
    private SpeechRecognizer speechRecognizer;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private String currentLang = "en-US";

    @Override
    public void load() {
        tts = new TextToSpeech(getContext(), status -> {
            if (status == TextToSpeech.SUCCESS) {
                ttsReady = true;
                tts.setLanguage(Locale.US);
                tts.setSpeechRate(0.96f);
                tts.setPitch(1.06f);

                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override
                    public void onStart(String utteranceId) {
                        JSObject data = new JSObject();
                        data.put("state", "start");
                        data.put("id", utteranceId);
                        notifyListeners("ttsState", data);
                    }

                    @Override
                    public void onDone(String utteranceId) {
                        JSObject data = new JSObject();
                        data.put("state", "done");
                        data.put("id", utteranceId);
                        notifyListeners("ttsState", data);
                    }

                    @Override
                    public void onError(String utteranceId) {
                        JSObject data = new JSObject();
                        data.put("state", "done");
                        data.put("id", utteranceId);
                        notifyListeners("ttsState", data);
                    }
                });
            }
        });
    }

    @PluginMethod
    public void speak(PluginCall call) {
        final String text = call.getString("text", "");
        final String lang = call.getString("lang", "en-US");
        final float rate = call.getFloat("rate", 0.96f);
        final float pitch = call.getFloat("pitch", 1.05f);

        if (text.trim().isEmpty() || !ttsReady) {
            JSObject res = new JSObject();
            res.put("spoken", false);
            call.resolve(res);
            return;
        }

        mainHandler.post(() -> {
            try {
                if (lang.toLowerCase().startsWith("vi")) {
                    Locale viLocale = new Locale("vi", "VN");
                    int avail = tts.isLanguageAvailable(viLocale);
                    if (avail >= TextToSpeech.LANG_AVAILABLE) {
                        tts.setLanguage(viLocale);
                    } else {
                        tts.setLanguage(Locale.US);
                    }
                } else {
                    tts.setLanguage(Locale.US);
                }
                tts.setSpeechRate(rate);
                tts.setPitch(pitch);

                String uttId = UUID.randomUUID().toString();
                Bundle params = new Bundle();
                tts.speak(text, TextToSpeech.QUEUE_FLUSH, params, uttId);

                JSObject res = new JSObject();
                res.put("spoken", true);
                res.put("id", uttId);
                call.resolve(res);
            } catch (Exception e) {
                JSObject res = new JSObject();
                res.put("spoken", false);
                call.resolve(res);
            }
        });
    }

    @PluginMethod
    public void stopSpeaking(PluginCall call) {
        mainHandler.post(() -> {
            if (tts != null) {
                tts.stop();
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void startListening(PluginCall call) {
        currentLang = call.getString("lang", "en-US");

        if (getPermissionState("microphone") != PermissionState.GRANTED &&
            ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissionForAlias("microphone", call, "micPermsCallback");
            return;
        }

        beginRecognition(call);
    }

    @PermissionCallback
    private void micPermsCallback(PluginCall call) {
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            beginRecognition(call);
        } else {
            call.reject("Bạn chưa cấp quyền Micro cho ứng dụng.");
        }
    }

    private void beginRecognition(PluginCall call) {
        mainHandler.post(() -> {
            try {
                if (tts != null) {
                    tts.stop();
                }

                if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
                    call.reject("Thiết bị chưa bật dịch vụ nhận diện giọng nói Google.");
                    return;
                }

                if (speechRecognizer != null) {
                    try {
                        speechRecognizer.destroy();
                    } catch (Exception ignored) {}
                    speechRecognizer = null;
                }

                speechRecognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
                speechRecognizer.setRecognitionListener(new RecognitionListener() {
                    @Override
                    public void onReadyForSpeech(Bundle params) {
                        JSObject ev = new JSObject();
                        ev.put("status", "ready");
                        notifyListeners("sttEvent", ev);
                    }

                    @Override
                    public void onBeginningOfSpeech() {
                        JSObject ev = new JSObject();
                        ev.put("status", "speaking");
                        notifyListeners("sttEvent", ev);
                    }

                    @Override
                    public void onRmsChanged(float rmsdB) {}

                    @Override
                    public void onBufferReceived(byte[] buffer) {}

                    @Override
                    public void onEndOfSpeech() {
                        JSObject ev = new JSObject();
                        ev.put("status", "processing");
                        notifyListeners("sttEvent", ev);
                    }

                    @Override
                    public void onError(int error) {
                        JSObject ev = new JSObject();
                        ev.put("status", "error");
                        ev.put("code", error);
                        notifyListeners("sttEvent", ev);
                    }

                    @Override
                    public void onResults(Bundle results) {
                        ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        String best = (matches != null && !matches.isEmpty()) ? matches.get(0) : "";
                        JSObject ev = new JSObject();
                        ev.put("status", "final");
                        ev.put("text", best);
                        notifyListeners("sttEvent", ev);
                    }

                    @Override
                    public void onPartialResults(Bundle partialResults) {
                        ArrayList<String> partial = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        String text = (partial != null && !partial.isEmpty()) ? partial.get(0) : "";
                        if (!text.isEmpty()) {
                            JSObject ev = new JSObject();
                            ev.put("status", "partial");
                            ev.put("text", text);
                            notifyListeners("sttEvent", ev);
                        }
                    }

                    @Override
                    public void onEvent(int eventType, Bundle params) {}
                });

                Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, currentLang);
                intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
                intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
                intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1600L);
                intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1400L);

                speechRecognizer.startListening(intent);
                call.resolve();
            } catch (Exception e) {
                call.reject("Lỗi khởi động Micro: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void stopListening(PluginCall call) {
        mainHandler.post(() -> {
            if (speechRecognizer != null) {
                try {
                    speechRecognizer.stopListening();
                } catch (Exception ignored) {}
            }
            call.resolve();
        });
    }

    @Override
    protected void handleOnDestroy() {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
        }
        if (speechRecognizer != null) {
            speechRecognizer.destroy();
        }
        super.handleOnDestroy();
    }
}
