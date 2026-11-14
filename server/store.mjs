import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export function createStore(directory) {
  fs.mkdirSync(directory, { recursive: true });
  for (const name of ["uploads", "episodes", "jobs"])
    fs.mkdirSync(path.join(directory, name), { recursive: true });
  const file = path.join(directory, "state.json");
  const state = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf8"))
    : { version: 1, seeded: false, messages: [], episodes: [] };
  function save() {
    const tmp = `${file}.${randomUUID()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, file);
  }
  return { state, save, directory };
}

export function publicMessage(message) {
  const { file, ...result } = message;
  return { ...result, audioUrl: `/media/uploads/${path.basename(file)}` };
}

export function deleteMessage(store, id) {
  const message = store.state.messages.find((item) => item.id === id);
  if (!message) return false;
  const episodes = store.state.episodes.filter((item) =>
    item.sourceMessageIds.includes(id),
  );
  // Persist revocation before deleting derived files; a restart must not re-expose them.
  store.state.messages = store.state.messages.filter((item) => item.id !== id);
  store.state.episodes = store.state.episodes.filter(
    (item) => !item.sourceMessageIds.includes(id),
  );
  store.save();
  fs.rmSync(
    path.join(store.directory, "uploads", path.basename(message.file)),
    { force: true },
  );
  for (const episode of episodes) {
    fs.rmSync(path.join(store.directory, "episodes", episode.id), {
      recursive: true,
      force: true,
    });
  }
  return true;
}
