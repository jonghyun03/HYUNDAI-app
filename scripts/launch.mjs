import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "../server/config.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const children = [];
const url = `http://127.0.0.1:${process.env.PORT || 8787}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function status(address) {
  try {
    const r = await fetch(address, { signal: AbortSignal.timeout(1200) });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}
function start(program, args, env = {}) {
  const child = spawn(program, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: "inherit",
  });
  children.push(child);
  child.on("error", (error) => {
    console.error(error.message);
    cleanup(1);
  });
  return child;
}
function cleanup(code = 0) {
  for (const child of children) child.kill("SIGTERM");
  process.exit(code);
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => cleanup());

if (!fs.existsSync(path.join(root, "node_modules"))) {
  console.error(
    "개발 도구 설치가 필요합니다. 프로젝트 폴더에서 npm install을 실행해주세요.",
  );
  process.exit(1);
}
if (!fs.existsSync(path.join(root, "dist/index.html"))) {
  console.error(
    "화면 빌드가 필요합니다. 프로젝트 폴더에서 npm run build를 실행해주세요.",
  );
  process.exit(1);
}
let appStatus = await status(`${url}/api/status`);
if (appStatus?.mode !== "local") {
  console.log("우리차 FM을 시작합니다…");
  const server = start(process.execPath, ["server/index.mjs"]);
  server.on("exit", (code) => {
    if (code) cleanup(code);
  });
  for (let i = 0; i < 40; i++) {
    appStatus = await status(`${url}/api/status`);
    if (appStatus?.mode === "local") break;
    await sleep(500);
  }
}
if (appStatus?.mode !== "local") {
  console.error("앱을 시작하지 못했습니다. 위 오류 내용을 확인해주세요.");
  cleanup(1);
}
console.log(
  `\n우리차 FM이 준비됐어요. ${url}\n이 창을 열어두고 사용하세요. 종료하려면 Control+C를 누르세요.\n`,
);
if (process.env.OPEN_BROWSER !== "0") {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer.exe" : "xdg-open";
  spawn(command, [url], { stdio: "ignore" }).on("error", () => console.log(`브라우저에서 ${url} 주소를 여세요.`));
}
// If an existing server handled the launch, do not leave an unnecessary process alive.
if (!children.length) process.exit(0);
