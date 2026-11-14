"""Local audio processing. Originals are read-only; all derivatives live in data/."""
import sys, json, subprocess, wave, math, array, os, platform
from pathlib import Path


def execute(args, env=None):
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
    if result.returncode:
        raise RuntimeError(result.stderr.decode(errors='replace')[-1800:])
    return result.stdout


def windows_speech(text_path='', output_path='', voice='', list_voices=False):
    # Pass user paths/text via environment and UTF-8 files, never as PowerShell code.
    # -Command invokes the Windows API without changing any execution-policy setting.
    script = Path(__file__).with_name('tts-windows.ps1').read_text(encoding='utf-8')
    env = {**os.environ, 'WOORICHA_TTS_TEXT': str(text_path), 'WOORICHA_TTS_OUTPUT': str(output_path),
           'WOORICHA_TTS_VOICE': voice, 'WOORICHA_TTS_LIST': '1' if list_voices else '0'}
    return execute(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', script], env=env)


def decode(source, output, ffmpeg, normalize=False, max_seconds=None):
    args = [ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(source), '-vn']
    if normalize:
        args += ['-af', 'loudnorm=I=-18:TP=-1.5:LRA=11']
    if max_seconds is not None:
        args += ['-t', str(max_seconds)]
    execute(args + ['-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', str(output)])
    with wave.open(str(output), 'rb') as w:
        return w.getnframes() / w.getframerate()


def inspect(source, ffmpeg):
    import tempfile
    with tempfile.TemporaryDirectory(prefix='wooricha-inspect-') as td:
        output = Path(td) / 'decoded.wav'
        # Decode only enough to reject inputs over six minutes without unbounded output.
        duration = decode(source, output, ffmpeg, max_seconds=361)
        with wave.open(str(output), 'rb') as w:
            samples = array.array('h', w.readframes(w.getnframes()))
        if not samples or max(abs(v) for v in samples) == 0:
            raise ValueError('소리가 없는 파일입니다.')
        rms = math.sqrt(sum(v*v for v in samples) / len(samples))
        return {'duration': round(duration, 3), 'sampleRate': 48000, 'channels': 1,
                'rmsDb': round(20*math.log10(max(rms, 1)/32768), 1),
                'peakDb': round(20*math.log10(max(abs(v) for v in samples)/32768), 1)}


def produce(input_path, ffmpeg):
    config = json.loads(Path(input_path).read_text(encoding='utf-8'))
    directory = Path(config['directory'])
    parts = []
    for i, part in enumerate(config['parts']):
        item = dict(part)
        output = directory / ('part-%02d.wav' % i)
        if item['kind'] == 'dj':
            text_file = directory / ('part-%02d.txt' % i)
            text_file.write_text(item['text'], encoding='utf-8')
            if platform.system() == 'Darwin':
                source = directory / ('part-%02d.aiff' % i)
                execute(['/usr/bin/say', '-v', config.get('voice') or 'Yuna', '-r', '175', '-f', str(text_file), '-o', str(source)])
            elif platform.system() == 'Windows':
                source = directory / ('part-%02d-tts.wav' % i)
                windows_speech(text_file, source, config.get('voice') or '')
            else:
                raise RuntimeError('DJ 음성 합성은 macOS 또는 Windows가 필요합니다.')
        else:
            source = Path(item['file'])
        item['duration'] = decode(source, output, ffmpeg, normalize=True)
        item['wav'] = str(output)
        parts.append(item)

    gap = .20
    # If actual synthesized speech exceeds the budget, remove whole trailing stories.
    while sum(p['duration'] for p in parts) + gap * (len(parts)-1) > config['targetSeconds']:
        family_indexes = [i for i, p in enumerate(parts) if p['kind'] == 'family']
        if len(family_indexes) <= 1:
            raise ValueError('실제 음원 길이가 선택한 시간을 넘습니다. 더 긴 방송 시간을 선택해주세요.')
        last = family_indexes[-1]
        del parts[last-1:last+1]

    combined = directory / 'broadcast.wav'
    chapters, position = [], 0
    with wave.open(str(combined), 'wb') as out:
        out.setnchannels(1); out.setsampwidth(2); out.setframerate(48000)
        for i, part in enumerate(parts):
            with wave.open(part['wav'], 'rb') as w:
                frames = w.readframes(w.getnframes())
                duration = w.getnframes()/48000
            chapter = {k: v for k, v in part.items() if k not in ('wav', 'file', 'duration')}
            chapter.update({'start': round(position, 4), 'end': round(position+duration, 4)})
            chapters.append(chapter)
            out.writeframes(frames)
            position += duration
            if i < len(parts)-1:
                out.writeframes(b'\x00\x00' * int(48000*gap)); position += gap
    with wave.open(str(combined), 'rb') as w:
        samples = array.array('h', w.readframes(w.getnframes()))
    size = max(1, len(samples)//100)
    levels = [math.sqrt(sum(v*v for v in samples[i:i+size])/len(samples[i:i+size])) for i in range(0, len(samples), size)]
    maximum = max(levels) or 1
    waveform = [round(max(.08, min(1, v/maximum)), 3) for v in levels[:100]]
    output = directory / 'broadcast.m4a'
    execute([ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(combined), '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', str(output)])
    result = {'duration': round(position, 3), 'chapters': chapters, 'waveform': waveform}
    (directory / 'audio.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    # Keep only the finished file and chapter manifest, not redundant private intermediates.
    for f in directory.iterdir():
        if f.name not in ('broadcast.m4a', 'audio.json'): f.unlink()
    return result


if __name__ == '__main__':
    try:
        if sys.argv[1] == 'inspect': result = inspect(sys.argv[2], sys.argv[3])
        elif sys.argv[1] == 'produce': result = produce(sys.argv[2], sys.argv[3])
        elif sys.argv[1] == 'voices':
            if platform.system() == 'Windows':
                output = windows_speech(list_voices=True)
            elif platform.system() == 'Darwin':
                output = execute(['/usr/bin/say', '-v', '?'])
            else:
                raise RuntimeError('음성 목록은 macOS 또는 Windows에서 확인하세요.')
            result = {'voices': output.decode('utf-8', errors='replace').splitlines()}
        else: raise ValueError('알 수 없는 오디오 명령')
        print(json.dumps(result, ensure_ascii=False))
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
