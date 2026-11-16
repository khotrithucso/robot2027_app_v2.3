import pathlib
import re

# 1. Nâng minSdkVersion lên 24 để NDK hỗ trợ đầy đủ POSIX_MADV_* cho llama-mmap.cpp
vars_path = pathlib.Path("android/variables.gradle")
if vars_path.exists():
    vars_content = vars_path.read_text(encoding="utf-8")
    vars_content = re.sub(r"minSdkVersion\s*=\s*\d+", "minSdkVersion = 24", vars_content)
    vars_path.write_text(vars_content, encoding="utf-8")
    print("Patched android/variables.gradle minSdkVersion = 24")

# 2. Cấu hình CMake NDK trong android/app/build.gradle
gradle_path = pathlib.Path("android/app/build.gradle")
if gradle_path.exists():
    content = gradle_path.read_text(encoding="utf-8")
    extra_blocks = '''
    defaultConfig {
        ndk {
            abiFilters "arm64-v8a"
        }
    }
    externalNativeBuild {
        cmake {
            path "src/main/cpp/CMakeLists.txt"
        }
    }
    androidResources {
        noCompress += ["gguf", "bin"]
    }
'''
    if "externalNativeBuild" not in content:
        content = content.replace("android {", "android {" + extra_blocks, 1)
        gradle_path.write_text(content, encoding="utf-8")
        print("Patched android/app/build.gradle")

# 3. Thêm quyền RECORD_AUDIO, INTERNET, usesCleartextTraffic & <queries> RecognitionService/TTS vào AndroidManifest.xml
manifest_path = pathlib.Path("android/app/src/main/AndroidManifest.xml")
if manifest_path.exists():
    m_txt = manifest_path.read_text(encoding="utf-8")
    if "android.permission.RECORD_AUDIO" not in m_txt:
        m_txt = m_txt.replace(
            "<uses-permission android:name=\"android.permission.INTERNET\" />",
            "<uses-permission android:name=\"android.permission.INTERNET\" />\n    <uses-permission android:name=\"android.permission.RECORD_AUDIO\" />"
        )
    if "usesCleartextTraffic" not in m_txt:
        m_txt = m_txt.replace("<application", "<application android:usesCleartextTraffic=\"true\"")
    if "<queries>" not in m_txt:
        queries_block = '''
    <queries>
        <intent>
            <action android:name="android.speech.RecognitionService" />
        </intent>
        <intent>
            <action android:name="android.intent.action.TTS_SERVICE" />
        </intent>
    </queries>
'''
        m_txt = m_txt.replace("</manifest>", queries_block + "\n</manifest>")
    manifest_path.write_text(m_txt, encoding="utf-8")
    print("Patched AndroidManifest.xml with RECORD_AUDIO, cleartext & <queries>")
