import "./config.mjs";
import express from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createStore, publicMessage, deleteMessage } from "./store.mjs";
import { aiStatus, inspectAudio, produceEpisode } from "./radio.mjs";
import { ttsDescription } from "../scripts/platform.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const idPattern = /^[a-zA-Z0-9-]{1,80}$/;
const problem = (status, message) =>
  Object.assign(new Error(message), { status });

export async function createApp({
  directory = path.join(root, "data"),
} = {}) {
  const store = createStore(directory);
  const jobs = new Map();
  let activeJob = null;
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "no-store");
    if (!["localhost", "127.0.0.1", "[::1]"].includes(req.hostname))
      return res
        .status(403)
        .json({ error: "이 버전은 같은 컴퓨터에서만 사용할 수 있습니다." });
    if (req.method !== "GET" && req.method !== "HEAD") {
      const origin = req.headers.origin;
      if (origin) {
        try {
          const url = new URL(origin);
          if (
            !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
            !["http:", "https:"].includes(url.protocol)
          )
            throw new Error();
          const permittedPorts = new Set([
            "5173",
            String(process.env.PORT || 8787),
            String(req.socket.localPort),
          ]);
          if (!permittedPorts.has(url.port)) throw new Error();
        } catch {
          return res.status(403).json({ error: "허용되지 않은 요청입니다." });
        }
      }
      if (req.headers["sec-fetch-site"] === "cross-site")
        return res
          .status(403)
          .json({ error: "다른 사이트에서 보낸 요청입니다." });
    }
    next();
  });
  app.use(express.json({ limit: "128kb" }));
  const upload = multer({
    storage: multer.diskStorage({
      destination: path.join(directory, "uploads"),
      filename: (_req, _file, cb) => cb(null, `${randomUUID()}.audio`),
    }),
    limits: {
      fileSize: 25 * 1024 * 1024,
      files: 1,
      fields: 5,
      fieldSize: 12000,
    },
    fileFilter: (_req, file, cb) => {
      if (
        file.mimetype.startsWith("audio/") ||
        ["video/mp4", "video/webm", "application/octet-stream"].includes(
          file.mimetype,
        )
      )
        cb(null, true);
      else cb(problem(400, "음성 파일을 선택해주세요."));
    },
  });
  app.get("/api/status", async (_req, res) =>
    res.json({
      mode: "local",
      ai: await aiStatus(),
      tts: ttsDescription(),
      firebase: {
        projectId: process.env.FIREBASE_PROJECT_ID || "",
        connected: false,
      },
      transcription: { available: false, input: "reference_or_manual" },
      messageCount: store.state.messages.length,
      episodeCount: store.state.episodes.length,
      activeJobId: activeJob?.id || null,
    }),
  );
  app.get("/api/messages", (_req, res) =>
    res.json(store.state.messages.map(publicMessage)),
  );
  app.post("/api/messages", upload.single("audio"), async (req, res, next) => {
    try {
      if (!req.file) throw problem(400, "녹음하거나 음성 파일을 선택해주세요.");
      const author = String(req.body.author || "").trim();
      const title = String(req.body.title || "").trim();
      const transcript = String(req.body.transcript || "").trim();
      if (
        !author ||
        author.length > 20 ||
        !title ||
        title.length > 60 ||
        !transcript ||
        transcript.length > 4000
      )
        throw problem(400, "이름·제목·말한 내용을 확인해주세요.");
      let audio;
      try {
        audio = await inspectAudio(req.file.path);
      } catch {
        throw problem(
          400,
          "음성 파일을 읽을 수 없습니다. 다른 파일로 다시 시도해주세요.",
        );
      }
      if (audio.duration > 360 || audio.duration < 0.5)
        throw problem(400, "음성은 0.5초 이상, 6분 이내로 준비해주세요.");
      const audioMime = [
        "audio/mp4",
        "audio/m4a",
        "audio/x-m4a",
        "audio/mpeg",
        "audio/wav",
        "audio/x-wav",
        "audio/webm",
        "audio/ogg",
      ].includes(req.file.mimetype)
        ? req.file.mimetype
        : "application/octet-stream";
      const message = {
        id: randomUUID(),
        file: req.file.filename,
        mime: audioMime,
        author,
        title,
        transcript,
        transcriptSource: "manual",
        source: "upload",
        duration: audio.duration,
        audioCheck: audio,
        createdAt: new Date().toISOString(),
      };
      store.state.messages.push(message);
      store.save();
      res.status(201).json(publicMessage(message));
    } catch (error) {
      if (req.file) fs.rmSync(req.file.path, { force: true });
      next(error);
    }
  });
  app.delete("/api/messages/:id", (req, res, next) => {
    if (activeJob)
      return next(problem(409, "방송 제작이 끝난 뒤 삭제해주세요."));
    if (!idPattern.test(req.params.id) || !deleteMessage(store, req.params.id))
      return next(problem(404, "사연을 찾을 수 없습니다."));
    res.json({ deleted: true });
  });
  app.get("/api/episodes", (_req, res) => res.json(store.state.episodes));
  app.post("/api/jobs", async (req, res, next) => {
    try {
      if (activeJob)
        throw problem(409, "이미 방송을 제작 중이에요. 잠시만 기다려주세요.");
      const { messageIds, targetSeconds, mode = "local_ai" } = req.body;
      if (![300, 600, 900].includes(targetSeconds))
        throw problem(400, "방송 길이를 선택해주세요.");
      if (!["local_ai", "basic"].includes(mode))
        throw problem(400, "제작 방식을 확인해주세요.");
      if (
        !Array.isArray(messageIds) ||
        !messageIds.length ||
        messageIds.length > 20 ||
        new Set(messageIds).size !== messageIds.length
      )
        throw problem(400, "사연을 1~20개 선택해주세요.");
      const messages = messageIds.map((id) =>
        store.state.messages.find((m) => m.id === id),
      );
      if (messages.some((m) => !m))
        throw problem(400, "삭제되었거나 없는 사연이 포함되어 있어요.");
      if (mode === "local_ai" && !(await aiStatus()).available)
        throw problem(
          409,
          "로컬 AI가 준비되지 않았어요. 기본 DJ 모드를 선택하거나 AI를 실행해주세요.",
        );
      // Reserve the single worker before returning, so simultaneous requests cannot overlap.
      if (activeJob) throw problem(409, "이미 방송을 제작 중이에요.");
      const job = {
        id: randomUUID(),
        stage: "queued",
        progress: 2,
        message: "방송 제작을 시작해요",
        createdAt: new Date().toISOString(),
        mode,
      };
      activeJob = job;
      jobs.set(job.id, job);
      res.status(202).json(job);
      setImmediate(async () => {
        try {
          const episode = await produceEpisode({
            store,
            job,
            messages,
            targetSeconds,
            mode,
            onProgress: (stage, progress, message) =>
              Object.assign(job, { stage, progress, message }),
          });
          Object.assign(job, {
            stage: "ready",
            progress: 100,
            message: "방송이 완성됐어요",
            episodeId: episode.id,
          });
        } catch (error) {
          console.error("방송 제작 실패:", error.message);
          fs.rmSync(path.join(directory, "episodes", job.id), {
            recursive: true,
            force: true,
          });
          Object.assign(job, {
            stage: "failed",
            progress: 0,
            message:
              "방송을 완성하지 못했어요. AI와 음성 합성 실행 상태를 확인한 뒤 다시 시도해주세요.",
          });
        } finally {
          activeJob = null;
        }
      });
    } catch (error) {
      next(error);
    }
  });
  app.get("/api/jobs/:id", (req, res, next) => {
    const job = jobs.get(req.params.id);
    if (!job)
      return next(
        problem(
          404,
          "제작 상태를 찾을 수 없습니다. 서버가 다시 시작되었다면 방송 목록을 확인해주세요.",
        ),
      );
    res.json(job);
  });
  app.delete("/api/episodes/:id", (req, res, next) => {
    const episode = store.state.episodes.find(
      (item) => item.id === req.params.id,
    );
    if (!episode || !idPattern.test(episode.id))
      return next(problem(404, "방송을 찾을 수 없습니다."));
    store.state.episodes = store.state.episodes.filter(
      (item) => item.id !== episode.id,
    );
    store.save();
    fs.rmSync(path.join(directory, "episodes", episode.id), {
      recursive: true,
      force: true,
    });
    res.json({ deleted: true });
  });
  // Expose only originals and the finished episode, never intermediate scripts or state.json.
  app.get("/media/uploads/:filename", (req, res, next) => {
    const message = store.state.messages.find(
      (item) => path.basename(item.file) === req.params.filename,
    );
    if (!message) return next(problem(404, "음성을 찾을 수 없습니다."));
    if (message.mime) res.type(message.mime);
    res.sendFile(path.join(directory, "uploads", path.basename(message.file)));
  });
  app.get("/media/episodes/:id/broadcast.m4a", (req, res, next) => {
    const episode = store.state.episodes.find(
      (item) => item.id === req.params.id,
    );
    if (!episode || !idPattern.test(episode.id))
      return next(problem(404, "방송을 찾을 수 없습니다."));
    res
      .type("audio/mp4")
      .sendFile(path.join(directory, "episodes", episode.id, "broadcast.m4a"));
  });
  const dist = path.join(root, "dist");
  app.use(express.static(dist));
  app.get("/", (_req, res) => {
    if (fs.existsSync(path.join(dist, "index.html")))
      res.sendFile(path.join(dist, "index.html"));
    else res.status(503).send("먼저 npm run build를 실행해주세요.");
  });
  app.use((error, _req, res, _next) => {
    if (error instanceof multer.MulterError)
      return res
        .status(400)
        .json({ error: "파일은 한 번에 하나, 25MB 이하로 올려주세요." });
    const status = error.status || 500;
    if (status >= 500) console.error(error.message);
    res.status(status).json({
      error:
        status >= 500
          ? "처리 중 문제가 생겼어요. 잠시 후 다시 시도해주세요."
          : error.message,
    });
  });
  app.use((_req, res) =>
    res.status(404).json({ error: "요청한 항목을 찾을 수 없습니다." }),
  );
  return { app, store, jobs };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { app } = await createApp({
    directory: process.env.DATA_DIR
      ? path.resolve(process.env.DATA_DIR)
      : undefined,
  });
  const port = Number(process.env.PORT || 8787);
  app.listen(port, "127.0.0.1", () =>
    console.log(`우리차 FM: http://127.0.0.1:${port}`),
  );
}
