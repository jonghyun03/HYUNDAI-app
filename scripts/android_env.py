"""Portable Android SDK and tool discovery."""
import os
import platform
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WINDOWS = platform.system() == 'Windows'


def find_sdk():
    candidates = [os.environ.get('ANDROID_HOME'), os.environ.get('ANDROID_SDK_ROOT')]
    local = ROOT / 'android/local.properties'
    if local.exists():
        for line in local.read_text(encoding='utf-8').splitlines():
            if line.strip().startswith('sdk.dir='):
                value = re.sub(r'\\u([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1), 16)), line.split('=', 1)[1])
                value = value.encode('utf-16', 'surrogatepass').decode('utf-16')
                candidates.append(value.replace('\\:', ':').replace('\\\\', '\\'))
    candidates.append(str(ROOT / '.runtime/android-sdk'))
    if WINDOWS:
        candidates.append(str(Path(os.environ.get('LOCALAPPDATA', Path.home() / 'AppData/Local')) / 'Android/Sdk'))
    else:
        candidates.extend([str(Path.home() / 'Library/Android/sdk'), str(Path.home() / 'Android/Sdk')])
    for item in candidates:
        if item and (Path(item).expanduser() / 'platforms/android-35/android.jar').is_file():
            return Path(item).expanduser().resolve()
    raise SystemExit('Android SDK API 35를 설치하고 ANDROID_HOME을 설정하세요. 운영체제별 실행 가이드를 참고하세요.')


def tool(sdk, name):
    relative = {'adb': 'platform-tools/adb', 'emulator': 'emulator/emulator'}[name]
    binary = sdk / (relative + ('.exe' if WINDOWS else ''))
    if not binary.is_file():
        raise SystemExit(f'{binary} 없음: Android Studio SDK Manager에서 {name} 도구를 설치하세요.')
    return str(binary)


def sdk_environment(sdk):
    return {**os.environ, 'ANDROID_HOME': str(sdk), 'ANDROID_SDK_ROOT': str(sdk)}


def write_local_properties(sdk):
    value = str(sdk).replace('\\', '/').replace(':', '\\:')
    escaped = ''
    for char in value:
        if ord(char) < 128:
            escaped += char
        else:
            units = char.encode('utf-16-be')
            escaped += ''.join('\\u' + units[i:i+2].hex() for i in range(0, len(units), 2))
    local = ROOT / 'android/local.properties'
    lines = local.read_text(encoding='utf-8').splitlines() if local.exists() else []
    lines = [line for line in lines if not line.strip().startswith('sdk.dir=')]
    local.write_text('\n'.join(lines + ['sdk.dir=' + escaped]) + '\n', encoding='utf-8')
