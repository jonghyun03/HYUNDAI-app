"""Install on a running Pleos device, or boot an Android Studio-created AVD."""
import argparse
from pathlib import Path
import subprocess
import time
from android_env import ROOT, find_sdk, tool, sdk_environment


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--serial', help='adb serial when multiple devices are connected')
    parser.add_argument('--avd', default='WoorichaPleos')
    parser.add_argument('--gpu', choices=['auto', 'host', 'software', 'swiftshader'], default='auto')
    parser.add_argument('--no-launch-app', action='store_true')
    parser.add_argument('--apk', type=Path, help='Install a prebuilt APK, including the submitted release APK.')
    args = parser.parse_args()
    sdk = find_sdk()
    adb, env = tool(sdk, 'adb'), sdk_environment(sdk)
    apk = args.apk or ROOT / 'android/app/build/outputs/apk/debug/app-debug.apk'
    if not apk.is_absolute():
        apk = ROOT / apk
    if not apk.exists():
        raise SystemExit('먼저 scripts/build-vehicle.py를 실행해 차량 APK를 빌드하세요.')

    def adb_run(*options, capture=False):
        return subprocess.run([adb, *options], env=env, text=True, encoding='utf-8',
                              errors='replace', capture_output=capture, check=True)

    adb_run('start-server')
    connected = [line.split()[0] for line in adb_run('devices', capture=True).stdout.splitlines()[1:]
                 if len(line.split()) > 1 and line.split()[1] == 'device']
    process = None
    if not connected and not args.serial:
        emulator = tool(sdk, 'emulator')
        avds = subprocess.check_output([emulator, '-list-avds'], env=env, text=True, encoding='utf-8').splitlines()
        # Reuse an older project-local AVD when present; fresh clones use Android Studio's AVDs.
        legacy = ROOT / '.runtime/avd'
        if args.avd not in avds and (legacy / (args.avd + '.ini')).is_file():
            env['ANDROID_AVD_HOME'] = str(legacy)
            env['ANDROID_USER_HOME'] = str(ROOT / '.runtime/android-user')
            env['ANDROID_EMULATOR_HOME'] = str(ROOT / '.runtime/android-user')
            avds = subprocess.check_output([emulator, '-list-avds'], env=env, text=True, encoding='utf-8').splitlines()
        if args.avd not in avds:
            raise SystemExit('Android Studio에서 Pleos AVD를 만들어 실행하거나 --avd 이름을 지정하세요. 발견된 AVD: ' + ', '.join(avds))
        runtime = ROOT / '.runtime'
        runtime.mkdir(exist_ok=True)
        with (runtime / 'pleos-emulator.log').open('ab') as log:
            process = subprocess.Popen([emulator, '-avd', args.avd, '-port', '5554', '-no-snapshot',
                                        '-memory', '4096', '-gpu', args.gpu], env=env, stdout=log, stderr=log)
        args.serial = 'emulator-5554'
    elif not args.serial:
        if len(connected) != 1:
            raise SystemExit('기기가 여러 개입니다. --serial 옵션으로 선택하세요: ' + ', '.join(connected))
        args.serial = connected[0]
    for _ in range(300):
        if process and process.poll() is not None:
            raise SystemExit('에뮬레이터가 종료됐습니다. .runtime/pleos-emulator.log를 확인하세요.')
        status = subprocess.run([adb, '-s', args.serial, 'shell', 'getprop', 'sys.boot_completed'],
                                capture_output=True, text=True, env=env)
        if status.stdout.strip() == '1':
            break
        time.sleep(1)
    else:
        raise SystemExit('기기 부팅을 확인하지 못했습니다. Device Manager와 --serial 값을 확인하세요.')
    automotive = adb_run('-s', args.serial, 'shell', 'pm', 'has-feature', 'android.hardware.type.automotive', capture=True)
    if automotive.stdout.strip() != 'true':
        raise SystemExit('선택한 기기가 Automotive 환경이 아닙니다. Pleos 에뮬레이터를 선택하세요.')
    adb_run('-s', args.serial, 'install', '-r', str(apk))
    if not args.no_launch_app:
        adb_run('-s', args.serial, 'shell', 'am', 'start', '--user', 'current', '-n', 'kr.wooricha.fm/.MainActivity')
    print('Pleos에 차량 앱을 설치했습니다. 에뮬레이터 창에서 확인하세요.')
    if process:
        print('에뮬레이터 창을 닫으면 실행 도구도 종료됩니다.')
        process.wait()


if __name__ == '__main__':
    main()
