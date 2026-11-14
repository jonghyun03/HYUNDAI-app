# 우리차 FM

가족이 남긴 녹음과 AI DJ 멘트를 엮어 차량에서 듣는 Pleos Connect 앱입니다. **주 실행 대상은 Kotlin 차량 앱**이며, React 웹과 Node 서버는 녹음·방송 제작을 돕는 로컬 도구입니다.

- [Windows 실행 가이드](WINDOWS.md)
- [macOS 실행 가이드](MACOS.md)

## 코드 구성

```text
android/          Kotlin 차량 앱과 Gradle 8.9 Wrapper
  app/src/main/   네이티브 화면, 미디어 서비스, 차량 UX 제한 처리
  app/src/androidTest/  실제 Android 기기의 미디어 연결 테스트
demo/vehicle/     개인정보 없는 공개 테스트 음원과 구간 정보
src/              React 가족용 녹음·방송 제작 화면
server/           로컬 API, 파일 저장, 방송 제작 작업 관리
scripts/          OS별 도구 검색, 빌드·실행, 음성 합성·오디오 편집
tests/            편성·삭제·API·방송 제작 검증
```

### 차량 앱

`MainActivity`는 재생·일시정지·이전/다음 사연·구간 탐색 화면을 제공합니다. `RadioService`는 Media3 `MediaLibraryService`와 `ExoPlayer`를 사용하며 기존 Android `MediaBrowser` 클라이언트도 연결할 수 있습니다. `RadioCatalog`는 방송 정보와 사연 구간을 읽습니다. `StandardCarUxMonitor`는 차량 UX 제한을 감시하며, API를 사용할 수 없는 환경에서는 조작을 보수적으로 제한합니다.

최소 API 28, target API 34, compile API 35, Build Tools 35.0.0, Kotlin 2.1.20, AGP 8.7.3, JDK 17을 사용합니다. Gradle Wrapper와 배포 파일 체크섬을 포함해 별도 Gradle 설치 없이 빌드합니다. 기본 음원은 12초짜리 테스트 안내음 4개이며 가족의 실제 목소리가 아닙니다. Android Studio에서도 이 공개 데모를 그대로 빌드할 수 있습니다.

### 녹음과 방송 제작

```text
브라우저 녹음 / 파일 업로드 + 수동 대본
 → data/uploads에 원본 복사본 저장
 → 기본 DJ 대본 또는 Ollama로 연결 멘트 작성
 → macOS say / Windows SAPI로 DJ 음성 합성
 → FFmpeg로 음량 조절·편집 후 M4A 생성
 → 로컬 웹에서 확인 후, 지정한 방송을 차량 APK에 포함
```

`server/index.mjs`는 API·업로드·작업 상태를, `store.mjs`는 사연·방송 목록과 삭제를, `radio.mjs`는 편성·AI 대본 검증·제작을 처리합니다. 원본 사연을 대신 읽지 않도록 DJ 대본을 검사하고, 사연 삭제 시 해당 사연으로 만든 방송도 앱 저장소에서 제거합니다.

`audio.py`는 Python 표준 라이브러리와 npm의 `ffmpeg-static`을 사용합니다. 별도 Python 패키지 설치는 필요 없습니다. 기본 DJ는 LLM 없이 동작하지만 OS 음성 합성은 필요합니다. AI DJ는 로컬 Ollama와 모델을 추가로 설치해야 합니다.

## 현재 범위

- 구현: 차량 재생·미디어 브라우징·구간 이동·백그라운드 서비스, 로컬 녹음 업로드·삭제, 방송 제작·다운로드.
- 미구현: Firebase 인증·가족 초대·원격 동기화, 자동 STT, NaviHelper 잔여시간 추천, Gleo 음성 명령.
- 검증 범위: 기존 Mac에서 Pleos 2.1.0 실행과 미디어 연결을 확인했습니다. Windows 실행 경로는 별도로 구성했으며 Windows 실기 검증 완료를 의미하지 않습니다.
- 웹 도구는 같은 PC에서 쓰는 개발용입니다. `127.0.0.1`에만 연결하며 가족·차량 간 원격 공유 서버 역할은 아직 없습니다.

## 공개 소스와 로컬 데이터

공개 데모는 직접 생성한 안내음만 포함하며 외부 음성 API·유료 계정이 필요 없습니다. 도구·모델의 최초 다운로드와 각 배포처의 이용 조건 확인은 필요합니다.

`.gitignore`는 `data/`, `.runtime/`, `.env`, `private/`, 원본 `음성파일/`, `결과물/`, 개인 SDK 경로, 생성 APK·빌드 캐시를 제외합니다. 원본 녹음과 신청서는 로컬에 보존합니다. Android SDK·Pleos 시스템 이미지·AI 모델은 저장소에 재배포하지 않습니다.

`WOORICHA_MEDIA_DIR`가 없으면 Gradle은 `demo/vehicle`을 사용합니다. 실행 스크립트는 프로젝트 내부 임시 폴더에 음원을 준비한 뒤 이 변수를 해당 빌드에만 전달합니다. 개인 방송은 명시적으로 `--episode-id`를 지정해야 하며, 만든 APK에도 해당 녹음이 포함됩니다.

## 검증 명령

두 운영체제 가이드에 도구 설치·빌드·테스트 명령이 있습니다. 웹 테스트는 공개 안내음으로 API 업로드, 잘못된 음원 거부, 중복 제작 차단, 범위 재생, 삭제 후 접근 차단을 검증합니다. 방송 제작 테스트에는 설치된 TTS 음성이 필요합니다. Android 기기 테스트에는 실행 중인 Pleos 에뮬레이터가 필요합니다.
