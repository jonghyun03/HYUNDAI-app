"""Build on macOS/Windows using the checked-in Gradle wrapper."""
import argparse
import json
import os
from pathlib import Path
import shutil
import hashlib
import subprocess
import sys
from android_env import ROOT, WINDOWS, find_sdk, sdk_environment, write_local_properties


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--episode-id', help='Explicitly package a private locally created episode.')
    parser.add_argument('--lint', action='store_true')
    parser.add_argument('--release', action='store_true', help='Build a signed release APK for contest submission.')
    parser.add_argument('--signing-config', type=Path, help='Private JSON config; never commit this file.')
    args = parser.parse_args()
    env = os.environ.copy()
    if args.release:
        config_path = args.signing_config or ROOT / 'private/signing/release.json'
        if config_path.exists():
            config = json.loads(config_path.read_text(encoding='utf-8'))
            for name in ['WOORICHA_KEYSTORE', 'WOORICHA_KEYSTORE_PASSWORD', 'WOORICHA_KEY_ALIAS', 'WOORICHA_KEY_PASSWORD']:
                if name not in env and config.get(name):
                    env[name] = config[name]
        required = ['WOORICHA_KEYSTORE', 'WOORICHA_KEYSTORE_PASSWORD', 'WOORICHA_KEY_ALIAS', 'WOORICHA_KEY_PASSWORD']
        if any(not env.get(name) for name in required):
            raise SystemExit('Release 서명 설정이 없습니다. README.md의 release 빌드 안내를 확인하세요.')
        key = Path(env['WOORICHA_KEYSTORE']).expanduser()
        if not key.is_absolute():
            key = ROOT / key
        if not key.is_file():
            raise SystemExit('Release 서명키 파일을 찾을 수 없습니다.')
        env['WOORICHA_KEYSTORE'] = str(key.resolve())
    sdk = find_sdk()
    write_local_properties(sdk)
    command = [sys.executable, str(ROOT / 'scripts/prepare-vehicle.py')]
    command += ['--episode-id', args.episode_id] if args.episode_id else ['--demo']
    subprocess.run(command, check=True)
    wrapper = ROOT / 'android' / ('gradlew.bat' if WINDOWS else 'gradlew')
    variant = 'Release' if args.release else 'Debug'
    tasks = [':app:assemble' + variant] + ([':app:lint' + variant] if args.lint else [])
    invocation = [str(wrapper), *tasks, '--console=plain']
    if WINDOWS:
        invocation = [os.environ.get('COMSPEC', 'cmd.exe'), '/d', '/c', wrapper.name, *tasks, '--console=plain']
    env = {**sdk_environment(sdk), **env, 'ANDROID_HOME': str(sdk), 'ANDROID_SDK_ROOT': str(sdk),
           'WOORICHA_MEDIA_DIR': str(ROOT / '.runtime/vehicle-media')}
    subprocess.run(invocation, cwd=ROOT / 'android', env=env, check=True)
    output = ROOT / 'android/app/build/outputs/apk' / variant.lower() / ('app-' + variant.lower() + '.apk')
    if args.release:
        target = ROOT / 'apk/종브라더스_우리차FM_release.apk'
        target.parent.mkdir(exist_ok=True)
        shutil.copy2(output, target)
        checksum = hashlib.sha256(target.read_bytes()).hexdigest()
        target.with_suffix('.apk.sha256').write_text(checksum + '  ' + target.name + '\n', encoding='utf-8')
        print('Submission APK:', target)
    else:
        print('APK:', output)


if __name__ == '__main__':
    main()
