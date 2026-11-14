# macOS 실행 가이드

Apple Silicon Mac에서 Pleos 차량 앱을 빌드·실행하는 절차입니다. Intel Mac은 앱 빌드와 웹 도구를 사용할 수 있으나, 공식 Mac용 Pleos ARM64 이미지 실행은 이 가이드의 검증 대상이 아닙니다. 호환 이미지 여부를 먼저 확인하세요.

## 1. 도구 설치

1. [Android Studio](https://developer.android.com/studio)를 Mac 칩에 맞게 설치합니다.
2. JDK **17**을 설치합니다. 최신 Android Studio 내장 JDK가 17이 아닐 수 있습니다.
3. [Python](https://www.python.org/downloads/macos/) **3.9 이상**을 설치합니다.
4. Android Studio → SDK Manager에서 **Android SDK Platform 35**, **Build Tools 35.0.0**, **Platform-Tools**, **Android Emulator**를 설치합니다.

터미널에서 확인합니다.

```sh
python3 --version
export JAVA_HOME="$(/usr/libexec/java_home -v 17)"
"$JAVA_HOME/bin/java" -version
```

SDK는 `~/Library/Android/sdk`를 자동 검색합니다. 설치 위치가 다르면 현재 터미널에 지정합니다.

```sh
export ANDROID_HOME="/실제/Android/SDK/폴더"
```

## 2. Pleos 에뮬레이터 설치

[공식 Pleos 설치 안내](https://document.pleos.ai/docs/connect/guide/getting-started/application-development/setup-connect-sdk-emulator)에 따라 설정합니다.

1. SDK Manager → SDK Update Sites에 다음 주소를 추가합니다.
   `https://nexus-playground.pleos.ai/repository/raw-releases/connect-avd/2.x/crp-arm64-sys-img.xml`
2. SDK Platforms에서 Show Package Details를 켜고 **API 34의 Pleos Connect 시스템 이미지 2.1.0**을 설치합니다. 배포처의 이용 조건은 직접 확인합니다.
3. Android Studio를 재시작하고 Device Manager → Create Device → Automotive → **Pleos Connect v2.1.0**을 선택합니다.
4. API 34 ARM64 Pleos 이미지, **RAM 4GB**, **Cold boot**로 AVD를 만듭니다. 이름은 `WoorichaPleos`로 지정하거나 아래 `--avd` 옵션에 실제 이름을 씁니다.

## 3. 차량 앱 실행

터미널에서 저장소 루트로 이동해 실행합니다.

```sh
chmod +x android/gradlew
python3 scripts/build-vehicle.py
python3 scripts/run-vehicle.py
```

위 준비를 마치면 `우리차FM_차량앱_실행.command`도 사용할 수 있습니다. 더블클릭 환경에서 `JAVA_HOME`이 잡히지 않으면 위 터미널 명령을 사용하세요. 최초 빌드는 Gradle·Android 의존성을 다운로드하므로 인터넷이 필요합니다.

- 생성 APK: `android/app/build/outputs/apk/debug/app-debug.apk`
- 기본 방송: **실제 사람 목소리 없는 12초 테스트 안내음 4개**
- 종료: 에뮬레이터 창을 닫습니다.

AVD 이름이 다르거나 화면이 하얗게 나오는 경우:

```sh
python3 scripts/run-vehicle.py --avd '실제 AVD 이름' --gpu swiftshader
```

[Android 그래픽 설정 안내](https://developer.android.com/studio/run/emulator-acceleration)에 따라 소프트웨어 렌더링을 사용할 수 있습니다. 이미 실행 중인 AVD의 그래픽 모드를 바꾸려면 먼저 해당 AVD를 종료합니다. Device Manager에서 먼저 부팅해 둬도 됩니다. 여러 기기가 있으면 `--serial emulator-5554`처럼 선택합니다.

Android Studio에서는 `android` 폴더를 열고 Gradle JDK를 17로 설정한 뒤 Pleos 기기를 선택합니다. 기본 공개 데모가 포함돼 있어 별도 개인 음성 파일이 필요 없습니다.

## 4. 가족용 웹 도구 사용하기

방송을 직접 만들 때만 추가로 준비합니다.

1. [Node.js](https://nodejs.org/) **22.12 이상**을 설치합니다.
2. 시스템 설정의 손쉬운 사용 → 말하기 관련 설정에서 한국어 **Yuna** 음성을 설치합니다. macOS 버전에 따라 메뉴 이름은 다를 수 있습니다.

사용 가능한 음성을 확인합니다.

```sh
say -v '?'
```

```sh
npm ci
cp .env.example .env
npm run build
npm start
```

브라우저에서 `http://127.0.0.1:8787`을 엽니다. **기본 DJ**는 Ollama 없이 사용할 수 있습니다. 녹음하거나 파일을 올린 뒤 말한 내용을 직접 입력합니다. 자동 전사는 아직 없습니다. 종료는 Ctrl+C입니다. `.env` 복사는 최초 한 번만 실행하세요. 다른 설치 음성을 쓰려면 `.env`의 `TTS_VOICE`를 바꿉니다.

AI DJ도 사용하려면 [Ollama Mac 설치 안내](https://docs.ollama.com/macos)에 따라 설치·실행한 뒤 모델을 받습니다. 현재 공식 Ollama의 OS 요구사항도 해당 페이지에서 확인하세요.

```sh
ollama pull qwen3:4b
```

Ollama 앱을 켜거나 별도 터미널에서 `npm run ai:start`를 실행합니다. 이미 실행 중이면 서버를 중복 실행하지 않습니다. 기본 Ollama 모델 저장소를 사용하며, 이전에 다른 곳에 받은 모델은 `OLLAMA_MODELS` 환경변수로 지정할 수 있습니다.

## 5. 만든 방송을 차량에 넣기

웹에서 방송을 만든 뒤 `data/state.json`의 원하는 방송 ID를 지정합니다.

```sh
python3 scripts/build-vehicle.py --episode-id '방송 ID'
python3 scripts/run-vehicle.py
```

음원은 무시되는 `.runtime/vehicle-media`에 준비됩니다. 생성 APK에는 개인 녹음이 들어갑니다. 기본 빌드를 다시 실행하면 공개 안내음으로 돌아갑니다.

## 6. 검증

```sh
npm run check
npm test
npm run build
python3 -m unittest discover -s tests -p 'test_*.py'
python3 scripts/build-vehicle.py --lint
```

Pleos 에뮬레이터를 켠 상태에서 미디어 연결 기기 테스트:

```sh
cd android
./gradlew :app:connectedDebugAndroidTest
```

웹 테스트에는 Yuna 등 설치된 TTS 음성이 필요합니다. 차량 APK 빌드·공개 안내음 재생에는 TTS·Ollama·개인 녹음이 필요 없습니다. 기존 Mac의 `.runtime`이나 `local.properties`를 다른 사람에게 복사할 필요도 없습니다.
