import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "../server/config.mjs";
import { ollamaCommand } from "./platform.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const child = spawn(ollamaCommand(), ["serve"], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    OLLAMA_HOST: "127.0.0.1:11434",
    OLLAMA_NO_CLOUD: "1",
  },
});
child.on("error", () => {
  console.error("Ollama를 설치하고 PATH 또는 OLLAMA_BIN을 확인하세요. 이미 실행 중이면 이 명령은 필요 없습니다.");
  process.exit(1);
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code || 0));
