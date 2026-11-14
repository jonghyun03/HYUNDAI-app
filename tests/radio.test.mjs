import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  selectMessages,
  validateScript,
  basicScript,
} from "../server/radio.mjs";
import { createStore, deleteMessage } from "../server/store.mjs";
import { createApp } from "../server/index.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));


test("편성 시간 제한은 원본 사연 전체를 유지하며 적용된다", () => {
  const messages = [
    { id: "long", duration: 290 },
    { id: "short", duration: 20 },
    { id: "next", duration: 280 },
  ];
  assert.deepEqual(
    selectMessages(messages, 300).map((m) => m.id),
    ["short"],
  );
  assert.throws(() => selectMessages([{ duration: 600 }], 300), /시간/);
});

test("AI 응답의 사연 누락·순서 변경을 차단한다", () => {
  const messages = [
    { id: "one", author: "나" },
    { id: "two", author: "친구" },
  ];
  const good = basicScript(messages);
  assert.equal(validateScript(good, messages).introductions.length, 2);
  assert.throws(
    () =>
      validateScript(
        { ...good, introductions: [...good.introductions].reverse() },
        messages,
      ),
    /ID/,
  );
  assert.throws(
    () => validateScript({ ...good, introductions: [] }, messages),
    /사연 수/,
  );
  const transcript =
    "친구에게 전하고 싶은 오늘의 긴 이야기를 실제 녹음 대신 그대로 읽으면 안 됩니다.";
  assert.throws(
    () =>
      validateScript(
        {
          ...good,
          introductions: [
            { messageId: "one", text: transcript },
            good.introductions[1],
          ],
        },
        [{ ...messages[0], transcript }, messages[1]],
      ),
    /대신 읽는/,
  );
});

test("사연 삭제가 파생 방송과 원본 복사본까지 제거되고 재시작에도 유지된다", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "wooricha-delete-"));
  try {
    const store = createStore(directory);
    fs.writeFileSync(path.join(directory, "uploads/private.audio"), "private");
    fs.mkdirSync(path.join(directory, "episodes/episode-1"));
    fs.writeFileSync(
      path.join(directory, "episodes/episode-1/broadcast.m4a"),
      "derived",
    );
    store.state.messages = [{ id: "story-1", file: "private.audio" }];
    store.state.episodes = [
      { id: "episode-1", sourceMessageIds: ["story-1"] },
      { id: "episode-2", sourceMessageIds: ["other"] },
    ];
    store.save();
    assert.equal(deleteMessage(store, "story-1"), true);
    assert.equal(
      fs.existsSync(path.join(directory, "uploads/private.audio")),
      false,
    );
    assert.equal(
      fs.existsSync(path.join(directory, "episodes/episode-1")),
      false,
    );
    const restarted = createStore(directory);
    assert.equal(restarted.state.messages.length, 0);
    assert.deepEqual(
      restarted.state.episodes.map((e) => e.id),
      ["episode-2"],
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test(
  "로컬 API: 업로드 검증·방송 제작·범위 재생·삭제·외부 요청 차단",
  { timeout: 120_000 },
  async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "wooricha-api-"));
    const { app, store } = await createApp({ directory, seedSamples: false });
    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const json = (body) => ({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    try {
      const status = await (await fetch(`${base}/api/status`)).json();
      assert.equal(status.firebase.connected, false);
      assert.equal(status.transcription.available, false);
      assert.equal((await fetch(`${base}/media/../state.json`)).status, 404);
      const blocked = await fetch(`${base}/api/jobs`, {
        ...json({}),
        headers: {
          "Content-Type": "application/json",
          Origin: "https://untrusted.invalid",
        },
      });
      assert.equal(blocked.status, 403);
      assert.equal(
        (
          await fetch(
            `${base}/api/jobs`,
            json({ messageIds: [], targetSeconds: 300 }),
          )
        ).status,
        400,
      );
      const invalid = new FormData();
      invalid.set("author", "나");
      invalid.set("title", "깨진 테스트 파일");
      invalid.set("transcript", "테스트");
      invalid.set(
        "audio",
        new Blob(["this is not audio"], { type: "audio/mp4" }),
        "broken.m4a",
      );
      assert.equal(
        (await fetch(`${base}/api/messages`, { method: "POST", body: invalid }))
          .status,
        400,
      );
      assert.equal(fs.readdirSync(path.join(directory, "uploads")).length, 0);
      const form = new FormData();
      form.set("author", "테스트");
      form.set("title", "검증용 녹음");
      form.set("transcript", "개인정보 없는 테스트 안내음입니다.");
      form.set(
        "audio",
        new Blob([fs.readFileSync(path.join(root, "demo/vehicle/res/raw/family_broadcast.wav"))], {
          type: "audio/wav",
        }),
        "sample.wav",
      );
      const upload = await fetch(`${base}/api/messages`, {
        method: "POST",
        body: form,
      });
      assert.equal(upload.status, 201);
      const message = await upload.json();
      assert.equal(message.transcriptSource, "manual");
      assert.ok(message.duration > 11 && message.duration < 13);
      assert.equal(message.file, undefined);
      const [first, second] = await Promise.all([
        fetch(
          `${base}/api/jobs`,
          json({ messageIds: [message.id], targetSeconds: 300, mode: "basic" }),
        ),
        fetch(
          `${base}/api/jobs`,
          json({ messageIds: [message.id], targetSeconds: 300, mode: "basic" }),
        ),
      ]);
      assert.deepEqual([first.status, second.status].sort(), [202, 409]);
      const job = await (first.status === 202 ? first : second).json();
      assert.equal(
        (
          await fetch(`${base}/api/messages/${message.id}`, {
            method: "DELETE",
          })
        ).status,
        409,
      );
      let state;
      for (let i = 0; i < 90; i++) {
        state = await (await fetch(`${base}/api/jobs/${job.id}`)).json();
        if (["ready", "failed"].includes(state.stage)) break;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      assert.equal(state.stage, "ready", JSON.stringify(state));
      const episode = store.state.episodes[0];
      assert.equal(episode.mode, "basic");
      assert.ok(episode.duration < 300 && episode.duration > message.duration);
      assert.equal(
        episode.chapters.filter((c) => c.kind === "family").length,
        1,
      );
      const ranged = await fetch(`${base}${episode.audioUrl}`, {
        headers: { Range: "bytes=0-99" },
      });
      assert.equal(ranged.status, 206);
      assert.equal((await ranged.arrayBuffer()).byteLength, 100);
      assert.equal(
        (
          await fetch(`${base}/api/messages/${message.id}`, {
            method: "DELETE",
          })
        ).status,
        200,
      );
      assert.equal((await fetch(`${base}${episode.audioUrl}`)).status, 404);
      assert.equal(store.state.episodes.length, 0);
    } finally {
      await new Promise((resolve) => server.close(resolve));
      fs.rmSync(directory, { recursive: true, force: true });
    }
  },
);
