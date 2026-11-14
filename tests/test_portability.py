"""SDK paths must survive Java properties on Windows and macOS."""
import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('android_env', ROOT / 'scripts/android_env.py')
android = importlib.util.module_from_spec(spec)
spec.loader.exec_module(android)


class SdkPathTests(unittest.TestCase):
    def test_non_ascii_and_spaces_round_trip_without_environment(self):
        with tempfile.TemporaryDirectory(prefix='wooricha-sdk-') as directory:
            root = Path(directory)
            sdk = root / '사용자 이름 😀' / 'Android SDK'
            (sdk / 'platforms/android-35').mkdir(parents=True)
            (sdk / 'platforms/android-35/android.jar').touch()
            (root / 'android').mkdir()
            (root / 'android/local.properties').write_text('custom.setting=keep\n', encoding='utf-8')
            with patch.object(android, 'ROOT', root), patch.dict(os.environ, {}, clear=True):
                android.write_local_properties(sdk)
                self.assertEqual(android.find_sdk(), sdk.resolve())
                content = (root / 'android/local.properties').read_text(encoding='ascii')
                self.assertIn('custom.setting=keep', content)
                self.assertIn('\\u', content)

    def test_explicit_sdk_precedes_local_properties(self):
        with tempfile.TemporaryDirectory(prefix='wooricha-sdk-') as directory:
            root = Path(directory)
            sdks = [root / 'old', root / 'selected']
            for sdk in sdks:
                (sdk / 'platforms/android-35').mkdir(parents=True)
                (sdk / 'platforms/android-35/android.jar').touch()
            (root / 'android').mkdir()
            with patch.object(android, 'ROOT', root), patch.dict(os.environ, {'ANDROID_HOME': str(sdks[1])}, clear=True):
                android.write_local_properties(sdks[0])
                self.assertEqual(android.find_sdk(), sdks[1].resolve())


if __name__ == '__main__':
    unittest.main()
