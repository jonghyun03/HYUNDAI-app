# Windows 실행 가이드

Windows x64에서 Pleos 차량 앱을 빌드·실행하는 절차입니다. Windows ARM은 검증 대상에 포함하지 않습니다. 웹 제작 도구는 선택 사항이며 차량 공개 데모에는 Node.js·Ollama·한국어 TTS가 필요 없습니다.

## 1. 도구 설치

1. [Android Studio](https://developer.android.com/studio)를 설치합니다. 에뮬레이터용 CPU 가상화와 [Windows 하이퍼바이저 설정](https://developer.android.com/studio/run/emulator-acceleration)을 확인합니다.
2. JDK **17**을 설치하고 `JAVA_HOME`을 해당 JDK 폴더로 지정합니다. 최신 Android Studio 내장 JDK가 17이 아닐 수 있습니다.
3. [Python](https://www.python.org/downloads/windows/) **3.9 이상**을 설치합니다. `py -3 --version`으로 확인합니다. GitHub 저장소는 가능하면 `C:\dev\wooricha-fm`처럼 짧은 폴더에 복제합니다.
4. Android Studio → SDK Manager에서 **Android SDK Platform 35**, **Build Tools 35.0.0**, **Platform-Tools**, **Android Emulator**를 설치합니다.

PowerShell에서 확인합니다.

```powershell
py -3 --version
& "$env:JAVA_HOME\bin\java.exe" -version
```

SDK는 기본 `%LOCALAPPDATA%\Android\Sdk`를 자동 검색합니다. 다른 위치에 설치했다면 현재 PowerShell에 지정합니다.

```powershell
$env:ANDROID_HOME = 'D:\Android\Sdk'
$env:JAVA_HOME = 'C:\실제 JDK 17 설치 폴더'
```

## 2. Pleos 에뮬레이터 설치

[공식 Pleos 설치 안내](https://document.pleos.ai/docs/connect/guide/getting-started/application-development/setup-connect-sdk-emulator)에 따라 설정합니다.

1. SDK Manager → SDK Update Sites에 다음 주소를 추가합니다.
   `https://nexus-playground.pleos.ai/repository/raw-releases/connect-avd/2.x/crp-sys-img.xml`
2. SDK Platforms에서 Show Package Details를 켜고 **API 34의 Pleos Connect 시스템 이미지 2.1.0**을 설치합니다. 배포처의 이용 조건은 직접 확인합니다.
3. Android Studio를 재시작하고 Device Manager → Create Device → Automotive → **Pleos Connect v2.1.0**을 선택합니다.
4. API 34 Pleos 이미지, **RAM 4GB**, **Cold boot**로 AVD를 만듭니다. 이름은 `WoorichaPleos`로 지정하거나 아래 `--avd` 옵션에 실제 이름을 씁니다.

## 3. 차량 앱 실행

PowerShell에서 저장소 루트로 이동해 실행합니다.

```powershell
py -3 scripts/build-vehicle.py
py -3 scripts/run-vehicle.py
```

또는 위 준비를 마친 뒤 루트의 `우리차FM_차량앱_실행.cmd`를 더블클릭합니다. 최초 빌드는 Gradle·Android 의존성을 다운로드하므로 인터넷이 필요합니다.

- 생성 APK: `android/app/build/outputs/apk/debug/app-debug.apk`
- 기본 방송: **실제 사람 목소리 없는 12초 테스트 안내음 4개**
- 종료: 에뮬레이터 창을 닫습니다.

AVD 이름이나 그래픽 설정이 다른 경우:

```powershell
py -3 scripts/run-vehicle.py --avd '실제 AVD 이름' --gpu software
```

Device Manager에서 먼저 부팅해 둬도 됩니다. 여러 기기가 연결돼 있으면 `--serial emulator-5554`처럼 선택합니다. Android Studio로 실행하려면 `android` 폴더를 열고 Gradle JDK를 17로 설정한 뒤 Pleos 기기를 선택합니다.

## 4. 가족용 웹 도구 사용하기

방송을 직접 만들 때만 추가로 준비합니다.

1. [Node.js](https://nodejs.org/) **22.12 이상**을 설치합니다.
2. Windows에 한국어 데스크톱 TTS 음성을 설치합니다. 모든 Windows 음성이 SAPI에 노출되는 것은 아니므로 아래 목록에서 확인하세요.

```powershell
py -3 scripts/audio.py voices
```

[Windows SpeechSynthesizer](https://learn.microsoft.com/en-us/dotnet/api/system.speech.synthesis.speechsynthesizer?view=netframework-4.8.1)가 읽을 수 있는 설치 음성만 사용합니다. `ko-KR` 음성이 없으면 차량 공개 데모는 계속 사용할 수 있지만 한국어 DJ 제작은 진행할 수 없습니다. `TTS_VOICE`에는 목록에 표시된 음성의 정확한 이름을 지정할 수 있습니다. 다른 언어의 음성을 지정한다고 한국어 발음이 보장되지는 않습니다.

```powershell
npm ci
Copy-Item .env.example .env
npm run build
npm start
```

브라우저에서 `http://127.0.0.1:8787`을 엽니다. **기본 DJ**를 고르면 Ollama 없이 제작합니다. 새 사연은 직접 녹음하거나 파일을 올리고, 말한 내용을 입력합니다. 자동 전사는 아직 없습니다. 종료는 Ctrl+C입니다.

`.env`를 복사하는 단계는 최초 한 번만 실행하세요. Python 검색에 실패하면 `PYTHON_BIN`에 `python.exe` 경로를 설정합니다. 음성 합성 코드는 Windows PowerShell에서 시스템 API를 호출하며 실행 정책을 변경하지 않습니다.

AI DJ도 사용하려면 [Ollama Windows 설치 안내](https://docs.ollama.com/windows)에 따라 설치·실행한 뒤 다음 명령으로 모델을 받습니다. 기본 저장 위치의 모델을 사용합니다.

```powershell
ollama pull qwen3:4b
```

Ollama 앱을 켜거나 별도 PowerShell에서 `npm run ai:start`를 실행합니다. 이미 Ollama가 실행 중이면 서버를 중복 실행하지 않습니다. 모델 다운로드에는 추가 저장 공간과 메모리가 필요합니다.

## 5. 만든 방송을 차량에 넣기

웹에서 방송을 만든 뒤 `data/state.json`의 원하는 방송 ID를 지정합니다.

```powershell
py -3 scripts/build-vehicle.py --episode-id '방송 ID'
py -3 scripts/run-vehicle.py
```

음원은 무시되는 `.runtime/vehicle-media`에 준비됩니다. 생성 APK에는 개인 녹음이 들어갑니다. 기본 빌드를 다시 실행하면 공개 안내음으로 돌아갑니다.

## 6. 검증

```powershell
npm run check
npm test
npm run build
py -3 -m unittest discover -s tests -p 'test_*.py'
py -3 scripts/build-vehicle.py --lint
```

Pleos 에뮬레이터를 켠 상태에서 미디어 연결 기기 테스트:

```powershell
cd android
.\gradlew.bat :app:connectedDebugAndroidTest
```

Windows 경로·SAPI 분기는 구현돼 있으나 Windows 실기에서 전체 절차를 검증한 상태는 아닙니다. 특히 한국어 TTS 설치 여부와 하이퍼바이저 설정에 따라 준비 과정이 다릅니다.
