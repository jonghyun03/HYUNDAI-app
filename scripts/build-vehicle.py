"""Build on macOS/Windows using the checked-in Gradle wrapper."""
import argparse
import os
import subprocess
import sys
from android_env import ROOT, WINDOWS, find_sdk, sdk_environment, write_local_properties


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--episode-id', help='Explicitly package a private locally created episode.')
    parser.add_argument('--lint', action='store_true')
    args = parser.parse_args()
    sdk = find_sdk()
    write_local_properties(sdk)
    command = [sys.executable, str(ROOT / 'scripts/prepare-vehicle.py')]
    command += ['--episode-id', args.episode_id] if args.episode_id else ['--demo']
    subprocess.run(command, check=True)
    wrapper = ROOT / 'android' / ('gradlew.bat' if WINDOWS else 'gradlew')
    tasks = [':app:assembleDebug'] + ([':app:lintDebug'] if args.lint else [])
    invocation = [str(wrapper), *tasks, '--console=plain']
    if WINDOWS:
        invocation = [os.environ.get('COMSPEC', 'cmd.exe'), '/d', '/c', wrapper.name, *tasks, '--console=plain']
    env = {**sdk_environment(sdk), 'WOORICHA_MEDIA_DIR': str(ROOT / '.runtime/vehicle-media')}
    subprocess.run(invocation, cwd=ROOT / 'android', env=env, check=True)
    print('APK:', ROOT / 'android/app/build/outputs/apk/debug/app-debug.apk')


if __name__ == '__main__':
    main()
