"""Public tones by default; personal audio requires an explicit episode ID."""
import argparse
import array
import json
import math
from pathlib import Path
import shutil
import sys
import wave

ROOT = Path(__file__).resolve().parent.parent


def prepare(episode_id=None, output=None):
    output = Path(output) if output else ROOT / '.runtime/vehicle-media'
    raw, assets = output / 'res/raw', output / 'assets'
    raw.mkdir(parents=True, exist_ok=True)
    assets.mkdir(parents=True, exist_ok=True)
    if not episode_id:
        rate, samples = 16000, array.array('h')
        for frequency in [330, 440, 550, 660]:
            for i in range(3 * rate):
                t = i / rate
                gain = min(1, t / .08, (3-t) / .08)
                samples.append(round(2200 * gain * math.sin(2 * math.pi * frequency * t)))
        if sys.byteorder != 'little':
            samples.byteswap()
        with wave.open(str(raw / 'family_broadcast.wav'), 'wb') as out:
            out.setparams((1, 2, rate, 0, 'NONE', 'not compressed'))
            out.writeframes(samples.tobytes())
        (raw / 'family_broadcast.m4a').unlink(missing_ok=True)
        catalog = {'title': '공개 테스트 방송 · 안내음 4개', 'isDemo': True, 'durationMs': 12000,
                   'stories': [{'id': f'demo-{i+1}', 'title': f'재생 테스트 {i+1}', 'author': '테스트 음원',
                                'startMs': i*3000, 'endMs': (i+1)*3000} for i in range(4)]}
    else:
        state_path = ROOT / 'data/state.json'
        if not state_path.exists():
            raise SystemExit('로컬 방송이 없습니다. 기본 데모는 --demo로 준비하세요.')
        state = json.loads(state_path.read_text(encoding='utf-8'))
        episode = next((e for e in state['episodes'] if e['id'] == episode_id), None)
        if episode is None:
            raise SystemExit('지정한 방송이 없습니다. data/state.json의 episode ID를 확인하세요.')
        family = [chapter for chapter in episode['chapters'] if chapter['kind'] == 'family']
        if not family:
            raise SystemExit('방송에 재생할 사연이 없습니다.')
        stories, start = [], 0
        for i, chapter in enumerate(family):
            end = episode['duration'] if i == len(family)-1 else chapter['end']
            stories.append({'id': chapter['messageId'], 'title': chapter['label'], 'author': chapter['author'],
                            'startMs': round(start*1000), 'endMs': round(end*1000)})
            start = end
        shutil.copyfile(ROOT / 'data/episodes' / episode['id'] / 'broadcast.m4a', raw / 'family_broadcast.m4a')
        (raw / 'family_broadcast.wav').unlink(missing_ok=True)
        catalog = {'title': episode['title'], 'durationMs': round(episode['duration']*1000), 'isDemo': False, 'stories': stories}
    (assets / 'broadcast.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print('Prepared:', catalog['title'], '|', len(catalog['stories']), 'tracks')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--demo', action='store_true')
    group.add_argument('--episode-id')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    prepare(args.episode_id, args.output)
