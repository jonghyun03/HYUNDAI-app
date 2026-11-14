import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
export function pythonCommand() {
  if (process.env.PYTHON_BIN) return { command: process.env.PYTHON_BIN, prefix: [] };
  const candidates = process.platform === 'win32'
    ? [{ command: 'py', prefix: ['-3'] }, { command: 'python', prefix: [] }]
    : [{ command: 'python3', prefix: [] }];
  for (const candidate of candidates) {
    const result = spawnSync(candidate.command, [...candidate.prefix, '-c', 'import sys; sys.exit(0 if sys.version_info >= (3,9) else 1)'], { windowsHide: true });
    if (result.status === 0) return candidate;
  }
  throw new Error('Python 3.9 이상을 설치하세요. 경로가 다르면 .env의 PYTHON_BIN에 실행 파일 경로를 지정하세요.');
}
export function ollamaCommand() {
  if (process.env.OLLAMA_BIN) return process.env.OLLAMA_BIN;
  const name = process.platform === 'win32' ? 'ollama.exe' : 'ollama';
  const local = path.join(root, '.runtime/bin', name);
  return fs.existsSync(local) ? local : name;
}
export function ttsDescription() {
  return {
    provider: process.platform === 'darwin' ? 'macOS' : process.platform === 'win32' ? 'Windows SAPI' : 'unsupported',
    voice: process.env.TTS_VOICE || (process.platform === 'darwin' ? 'Yuna' : 'ko-KR 자동 선택'),
  };
}
