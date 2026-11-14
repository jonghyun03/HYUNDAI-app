import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const paths = {
  radio: (
    <>
      <rect x="3" y="7" width="18" height="14" rx="4" />
      <path d="m7 7 10-5M7 12h10M16 17h1" />
      <circle cx="8" cy="17" r="1.5" />
    </>
  ),
  inbox: (
    <>
      <path d="M4 4h16v16H4zM4 13h5l2 3h2l2-3h5M8 8h8" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="2" width="6" height="13" rx="3" />
      <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" />
    </>
  ),
  play: <path d="m9 5 11 7-11 7z" />,
  pause: (
    <>
      <path d="M8 5v14M16 5v14" />
    </>
  ),
  next: (
    <>
      <path d="m5 5 10 7-10 7zM19 5v14" />
    </>
  ),
  previous: (
    <>
      <path d="m19 5-10 7 10 7zM5 5v14" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  check: <path d="m5 12 4 4L19 6" />,
  download: (
    <>
      <path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4m-5 5 5-5 5 5M4 17v4h16v-4" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
    </>
  ),
  headphones: (
    <>
      <path d="M4 14v-3a8 8 0 0 1 16 0v3" />
      <rect x="3" y="12" width="4" height="8" rx="2" />
      <rect x="17" y="12" width="4" height="8" rx="2" />
    </>
  ),
  spark: (
    <>
      <path d="m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3zM20 2v4m-2-2h4" />
    </>
  ),
  heart: (
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
};
function Icon({ name, size = 20, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
const time = (seconds = 0) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
const date = (value) =>
  new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
async function api(url, options) {
  const response = await fetch(`/api${url}`, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "요청을 완료하지 못했어요.");
  return data;
}
function Avatar({ author, size = "" }) {
  return (
    <span className={`avatar ${author === "친구" ? "peach" : "sage"} ${size}`}>
      {author?.slice(0, 1) || "나"}
    </span>
  );
}
function Album({ mini = false, playing = false }) {
  return (
    <div
      className={`album ${mini ? "mini" : ""} ${playing ? "playing" : ""}`}
      aria-hidden="true"
    >
      <span className="album-sun" />
      <span className="album-line" />
      <span className="album-word">
        우리의
        <br />
        작은 라디오
      </span>
      <span className="album-mark">WOORICHA FM</span>
    </div>
  );
}

function App() {
  const [tab, setTab] = useState("radio");
  const [messages, setMessages] = useState([]),
    [episodes, setEpisodes] = useState([]),
    [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [toast, setToast] = useState("");
  const [buildOpen, setBuildOpen] = useState(false),
    [job, setJob] = useState(null);
  const [selected, setSelected] = useState(null),
    [playing, setPlaying] = useState(false),
    [position, setPosition] = useState(0);
  const [detail, setDetail] = useState(null),
    [deleteTarget, setDeleteTarget] = useState(null);
  const audio = useRef(null),
    shouldPlay = useRef(false),
    lastSaved = useRef(0),
    pendingSeek = useRef(null);
  const current = episodes.find((item) => item.id === selected);
  const currentChapter = current?.chapters.find(
    (chapter) => position >= chapter.start && position < chapter.end,
  );
  async function refresh() {
    const [m, e, s] = await Promise.all([
      api("/messages"),
      api("/episodes"),
      api("/status"),
    ]);
    setMessages(m);
    setEpisodes(e);
    setStatus(s);
    if (s.activeJobId) setJob(await api(`/jobs/${s.activeJobId}`));
    return e;
  }
  useEffect(() => {
    refresh()
      .then((e) => {
        if (e.length) setSelected(e[0].id);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);
  useEffect(() => {
    const solo = (event) => {
      if (event.target instanceof HTMLAudioElement)
        document.querySelectorAll("audio").forEach((item) => {
          if (item !== event.target) item.pause();
        });
    };
    document.addEventListener("play", solo, true);
    return () => document.removeEventListener("play", solo, true);
  }, []);
  useEffect(() => {
    setPlaying(false);
    setPosition(0);
    lastSaved.current = 0;
  }, [selected]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    if (!job || ["ready", "failed"].includes(job.stage)) return;
    let cancelled = false;
    const id = setInterval(async () => {
      try {
        const next = await api(`/jobs/${job.id}`);
        if (cancelled) return;
        setJob(next);
        if (next.stage === "ready") {
          await refresh();
          setSelected(next.episodeId);
          setBuildOpen(false);
          setToast("새 방송이 도착했어요. 재생 버튼을 눌러 들어보세요.");
        }
      } catch (e) {
        if (!cancelled)
          setJob((old) => ({ ...old, stage: "failed", message: e.message }));
      }
    }, 1200);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [job?.id, job?.stage]);
  useEffect(() => {
    if (!current && audio.current) {
      audio.current.pause();
      setPlaying(false);
      setPosition(0);
    }
  }, [current]);
  function listen(episode) {
    if (selected === episode.id) {
      if (audio.current.paused)
        audio.current
          .play()
          .catch(() => setToast("재생할 수 없어요. 다시 눌러주세요."));
      else audio.current.pause();
    } else {
      shouldPlay.current = true;
      setSelected(episode.id);
      setPosition(0);
    }
  }
  function readyAudio() {
    let saved = 0;
    try {
      saved =
        Number(localStorage.getItem(`wooricha-position-${current.id}`)) || 0;
    } catch {}
    audio.current.currentTime =
      pendingSeek.current !== null
        ? pendingSeek.current
        : saved < current.duration - 1
          ? saved
          : 0;
    pendingSeek.current = null;
    if (shouldPlay.current) {
      shouldPlay.current = false;
      audio.current
        .play()
        .catch(() => setToast("재생 버튼을 한 번 더 눌러주세요."));
    }
  }
  function seek(seconds) {
    if (audio.current && current) {
      audio.current.currentTime = Math.max(
        0,
        Math.min(current.duration, seconds),
      );
      setPosition(audio.current.currentTime);
    }
  }
  function chooseChapter(episode, seconds) {
    if (selected !== episode.id) {
      pendingSeek.current = seconds;
      shouldPlay.current = false;
      setSelected(episode.id);
    } else seek(seconds);
    setDetail(null);
  }
  function nextStory(direction = 1) {
    if (!current) return;
    const starts = current.chapters
      .filter((c) => c.kind === "family")
      .map(
        (c) =>
          current.chapters.find(
            (p) => p.kind === "dj" && p.messageId === c.messageId,
          )?.start ?? c.start,
      );
    const point =
      direction > 0
        ? starts.find((start) => start > position + 0.5)
        : [...starts].reverse().find((start) => start < position - 2);
    seek(point ?? (direction > 0 ? current.duration : 0));
  }
  async function remove() {
    try {
      await api(`/${deleteTarget.type}/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const e = await refresh();
      if (selected && !e.some((item) => item.id === selected))
        setSelected(e[0]?.id || null);
      setDetail(null);
      setDeleteTarget(null);
      setToast("삭제했어요. 연결된 방송에도 반영했습니다.");
    } catch (e) {
      setToast(e.message);
      setDeleteTarget(null);
    }
  }
  const busy = job && !["ready", "failed"].includes(job.stage);
  const latest = current || episodes[0];
  const uniqueAuthors = [...new Set(messages.map((m) => m.author))];

  return (
    <div className={`app ${current ? "with-player" : ""}`}>
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab("radio");
          }}
        >
          <span className="brand-icon">
            <Icon name="radio" size={26} />
          </span>
          <span>
            우리차 <b>FM</b>
            <small>우리의 이야기가 주파수가 되다</small>
          </span>
        </a>
        <div className="space-label">OUR LITTLE STATION</div>
        <nav aria-label="주 메뉴">
          {[
            ["radio", "radio", "우리 라디오"],
            ["inbox", "inbox", "사연 보관함"],
            ["record", "mic", "목소리 남기기"],
          ].map(([value, icon, label]) => (
            <button
              key={value}
              className={`nav-item ${tab === value ? "active" : ""}`}
              onClick={() => setTab(value)}
            >
              <Icon name={icon} />
              <span>{label}</span>
              {value === "inbox" && <small>{messages.length}</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="note-doodle">
            <Icon name="heart" size={24} />
          </span>
          <strong>
            짧은 한마디도,
            <br />
            누군가에겐 긴 여운.
          </strong>
          <p>
            오늘의 작은 이야기를
            <br />
            목소리로 남겨보세요.
          </p>
          <button onClick={() => setTab("record")}>
            이야기 남기기 <Icon name="arrow" size={16} />
          </button>
        </div>
        <div className="local-info">
          <span className="live-dot" /> 내 컴퓨터에만 저장
          <small>로컬 MVP · 계정 공유 연결 전</small>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <span className="tiny-label">목소리로 이어지는 우리</span>
            <h1>
              {tab === "radio"
                ? "우리 라디오"
                : tab === "inbox"
                  ? "사연 보관함"
                  : "목소리 남기기"}
            </h1>
          </div>
          <div className="topbar-right">
            <span className="local-pill">LOCAL STATION</span>
            <span className="profile">우</span>
          </div>
        </header>
        {error && (
          <div className="error-banner" role="alert">
            {error}
            <button onClick={() => window.location.reload()}>다시 연결</button>
          </div>
        )}
        {loading ? (
          <div className="loading">
            <span className="spinner" />
            우리의 이야기를 불러오고 있어요
          </div>
        ) : (
          <>
            {tab === "radio" && (
              <>
                <section className="hero">
                  <div className="hero-copy">
                    <div className="hero-eyebrow">
                      <span /> EVERY VOICE, CLOSER TOGETHER
                    </div>
                    <h2>
                      서로 다른 하루,
                      <br />
                      <em>같은 주파수.</em>
                    </h2>
                    <p>
                      바쁜 하루 사이에 놓친 이야기들.
                      <br />
                      익숙한 목소리로, 천천히 함께 들어요.
                    </p>
                    <button
                      className="button coral"
                      onClick={() => setBuildOpen(true)}
                    >
                      <Icon name={busy ? "clock" : "spark"} size={19} />
                      {busy ? "방송 제작 중" : "우리 방송 만들기"}
                      <Icon name="arrow" size={18} />
                    </button>
                  </div>
                  <div className="hero-art" aria-hidden="true">
                    <div className="orbit orbit-one" />
                    <div className="orbit orbit-two" />
                    <div className="vinyl">
                      <div className="vinyl-label">
                        <Icon name="radio" size={35} />
                        <span>
                          WOORICHA
                          <br />
                          FAMILY RADIO
                        </span>
                        <i />
                      </div>
                    </div>
                    <div className="art-sticker">
                      <span>made of</span>
                      <strong>우리의 목소리</strong>
                      <Icon name="heart" size={16} />
                    </div>
                    <span className="art-star star-one">✳</span>
                    <span className="art-star star-two">✳</span>
                  </div>
                  <span className="hero-corner">FAMILY STORIES, ON AIR.</span>
                </section>

                <div className="section-heading">
                  <div>
                    <span className="tiny-label">
                      A LITTLE CLOSER, EVERY DAY
                    </span>
                    <h2>오늘, 함께 들을 이야기</h2>
                  </div>
                  <span className="section-note">
                    진짜 목소리로 채운 우리만의 방송
                  </span>
                </div>
                <div className="radio-grid">
                  <div className="main-column">
                    <section className="featured card">
                      <div className="featured-main">
                        <Album playing={playing} />
                        <div className="featured-copy">
                          <span className="eyebrow">
                            <span className="live-dot" />
                            {latest
                              ? "방금 도착한 우리 방송"
                              : "첫 방송을 기다리는 중"}
                          </span>
                          <h3>
                            {latest?.title ||
                              "우리의 첫 이야기를\n시작해볼까요?"}
                          </h3>
                          <p>
                            {latest
                              ? `${date(latest.createdAt)} · 사연 ${latest.sourceMessageIds.length}개 · ${time(latest.duration)}`
                              : `목소리 ${messages.length}개가 모였어요.\nDJ 멘트를 더해 하나의 방송으로 엮어드려요.`}
                          </p>
                          <button
                            className="button dark"
                            disabled={!messages.length && !latest}
                            onClick={() =>
                              latest ? listen(latest) : setBuildOpen(true)
                            }
                          >
                            <Icon
                              name={
                                latest
                                  ? playing && selected === latest.id
                                    ? "pause"
                                    : "play"
                                  : "plus"
                              }
                              size={18}
                            />
                            {latest
                              ? playing && selected === latest.id
                                ? "잠시 멈추기"
                                : "지금 들어보기"
                              : "첫 방송 만들기"}
                          </button>
                        </div>
                      </div>
                      <div className="featured-footer">
                        <span>
                          <Icon name="headphones" size={15} /> 가족의 실제 녹음
                          + DJ 목소리
                        </span>
                        <span>
                          {latest
                            ? latest.mode === "local_ai"
                              ? "AI DJ 편성"
                              : "기본 DJ 편성"
                            : "원본 목소리를 그대로"}
                        </span>
                      </div>
                    </section>
                    <section className="episodes-section">
                      <div className="small-heading">
                        <h3>
                          지난 방송 <span>{episodes.length}</span>
                        </h3>
                        <span>작은 순간들을 다시 들어요</span>
                      </div>
                      {!episodes.length ? (
                        <div className="empty-list">
                          <span className="empty-icon">
                            <Icon name="radio" size={27} />
                          </span>
                          <strong>아직 저장된 방송이 없어요</strong>
                          <p>첫 방송을 만들면 여기에 차곡차곡 쌓여요.</p>
                        </div>
                      ) : (
                        episodes.map((episode, index) => (
                          <article className="episode-row" key={episode.id}>
                            <span className="episode-number">
                              {String(episodes.length - index).padStart(2, "0")}
                            </span>
                            <Album mini />
                            <button
                              className="episode-title"
                              onClick={() =>
                                setDetail({ type: "episode", data: episode })
                              }
                            >
                              <strong>{episode.title}</strong>
                              <small>
                                {date(episode.createdAt)} <span>·</span>{" "}
                                {episode.sourceMessageIds.length}개의 목소리{" "}
                                <span>·</span> {time(episode.duration)}
                              </small>
                            </button>
                            <button
                              className="round-button"
                              aria-label={`${episode.title} ${playing && selected === episode.id ? "일시정지" : "재생"}`}
                              onClick={() => listen(episode)}
                            >
                              <Icon
                                name={
                                  playing && selected === episode.id
                                    ? "pause"
                                    : "play"
                                }
                                size={18}
                              />
                            </button>
                          </article>
                        ))
                      )}
                    </section>
                  </div>
                  <aside className="stories-card card">
                    <div className="small-heading">
                      <h3>
                        도착한 목소리 <span>{messages.length}</span>
                      </h3>
                      <button
                        className="text-button"
                        onClick={() => setTab("inbox")}
                        aria-label="사연 보관함 전체 보기"
                      >
                        <Icon name="arrow" size={18} />
                      </button>
                    </div>
                    <p className="muted stories-intro">
                      각자의 자리에서 보내온 작은 안부
                    </p>
                    {messages
                      .slice(-4)
                      .reverse()
                      .map((message) => (
                        <button
                          key={message.id}
                          className="story-preview"
                          onClick={() =>
                            setDetail({ type: "message", data: message })
                          }
                        >
                          <Avatar author={message.author} />
                          <span>
                            <strong>
                              {message.author}
                              <small>{time(message.duration)}</small>
                            </strong>
                            <p>{message.title}</p>
                            <div className="mini-wave">
                              {[
                                4, 10, 7, 15, 6, 11, 17, 8, 13, 5, 10, 7, 12, 5,
                              ].map((n, i) => (
                                <i key={i} style={{ height: n }} />
                              ))}
                            </div>
                          </span>
                        </button>
                      ))}
                    {!messages.length && (
                      <p className="muted">첫 목소리를 남겨주세요.</p>
                    )}
                    <button
                      className="add-story"
                      onClick={() => setTab("record")}
                    >
                      <Icon name="plus" size={17} /> 나도 목소리 남기기
                    </button>
                  </aside>
                </div>
                <div className="bottom-note">
                  <Icon name="heart" size={15} />
                  <p>멀리 있어도, 목소리는 가장 가까이에.</p>
                  <span>WOORICHA FM</span>
                </div>
              </>
            )}

            {tab === "inbox" && (
              <>
                <section className="page-intro">
                  <div>
                    <span className="eyebrow">VOICE LETTERS</span>
                    <h2>
                      작은 안부가 모여
                      <br />
                      우리의 이야기가 돼요.
                    </h2>
                    <p>모든 녹음은 원본 그대로 보관합니다.</p>
                  </div>
                  <button
                    className="button dark"
                    onClick={() => setTab("record")}
                  >
                    <Icon name="plus" size={18} /> 새 목소리 남기기
                  </button>
                </section>
                <div className="library-top">
                  <span>
                    전체 사연 <b>{messages.length}</b>
                  </span>
                  <span>
                    {uniqueAuthors.join(" · ") || "첫 이야기를 기다리고 있어요"}
                  </span>
                </div>
                <div className="message-grid">
                  {messages.map((message) => (
                    <article className="message-card card" key={message.id}>
                      <div className="message-card-top">
                        <Avatar author={message.author} />
                        <span>
                          <strong>{message.author}</strong>
                          <small>{date(message.createdAt)}</small>
                        </span>
                        <span className="duration-pill">
                          {time(message.duration)}
                        </span>
                      </div>
                      <h3>{message.title}</h3>
                      <p className="transcript-excerpt">{message.transcript}</p>
                      <audio
                        controls
                        preload="none"
                        src={message.audioUrl}
                        aria-label={`${message.title} 원본 듣기`}
                        onPlay={() => audio.current?.pause()}
                      />
                      <div className="message-card-footer">
                        <span>
                          {message.transcriptSource === "reference"
                            ? "제공된 대본"
                            : "직접 적은 내용"}
                        </span>
                        <button
                          className="text-button"
                          onClick={() =>
                            setDeleteTarget({
                              type: "messages",
                              id: message.id,
                              title: message.title,
                            })
                          }
                          aria-label={`${message.title} 삭제`}
                        >
                          <Icon name="trash" size={17} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
                {!messages.length && (
                  <div className="empty-list">
                    <strong>아직 남겨진 목소리가 없어요</strong>
                    <p>녹음하거나 파일을 올려 첫 사연을 만들어주세요.</p>
                  </div>
                )}
              </>
            )}

            {tab === "record" && (
              <RecordForm
                onSaved={async () => {
                  await refresh();
                  setTab("inbox");
                  setToast("목소리가 도착했어요. 새 방송에 담아보세요.");
                }}
                onError={setToast}
              />
            )}
          </>
        )}
      </main>
      {current && (
        <footer className="player">
          <div className="player-track">
            <Album mini playing={playing} />
            <div>
              <strong>{current.title}</strong>
              <small>
                {currentChapter?.kind === "family"
                  ? `${currentChapter.author} 님의 실제 목소리`
                  : "우리차 FM · DJ 멘트"}
              </small>
            </div>
          </div>
          <div className="player-center">
            <div className="player-controls">
              <button
                className="text-button"
                aria-label="이전 사연"
                onClick={() => nextStory(-1)}
              >
                <Icon name="previous" size={20} />
              </button>
              <button
                className="player-play"
                aria-label={playing ? "방송 일시정지" : "방송 재생"}
                onClick={() => listen(current)}
              >
                <Icon name={playing ? "pause" : "play"} size={21} />
              </button>
              <button
                className="text-button"
                aria-label="다음 사연"
                onClick={() => nextStory(1)}
              >
                <Icon name="next" size={20} />
              </button>
            </div>
            <div className="player-seek">
              <time>{time(position)}</time>
              <input
                aria-label="방송 재생 위치"
                type="range"
                min="0"
                max={current.duration}
                step="0.1"
                value={position}
                onChange={(e) => seek(Number(e.target.value))}
                style={{
                  "--progress": `${(position / current.duration) * 100}%`,
                }}
              />
              <time>{time(current.duration)}</time>
            </div>
          </div>
          <button
            className="player-chapters"
            onClick={() => setDetail({ type: "episode", data: current })}
          >
            <span className="live-dot" /> 사연 순서{" "}
            <Icon name="inbox" size={18} />
          </button>
        </footer>
      )}
      <audio
        ref={audio}
        src={current?.audioUrl}
        onLoadedMetadata={readyAudio}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          try {
            localStorage.removeItem(`wooricha-position-${current.id}`);
          } catch {}
        }}
        onError={() => {
          if (current) setToast("방송 파일을 불러오지 못했어요.");
        }}
        onTimeUpdate={() => {
          const p = audio.current.currentTime;
          setPosition(p);
          if (Math.abs(p - lastSaved.current) > 3 && current) {
            try {
              localStorage.setItem(
                `wooricha-position-${current.id}`,
                String(p),
              );
            } catch {}
            lastSaved.current = p;
          }
        }}
      />
      {buildOpen && (
        <BuildDialog
          messages={messages}
          status={status}
          job={job}
          setJob={setJob}
          onClose={() => setBuildOpen(false)}
        />
      )}
      {detail && (
        <Modal
          title={
            detail.type === "message" ? "도착한 목소리" : "방송에 담긴 이야기"
          }
          onClose={() => setDetail(null)}
        >
          <div className="detail-content">
            <span className="eyebrow">
              {detail.type === "message"
                ? detail.data.author
                : detail.data.mode === "local_ai"
                  ? "AI DJ 편성"
                  : "기본 DJ 편성"}
            </span>
            <h3>{detail.data.title}</h3>
            {detail.type === "message" ? (
              <>
                <p className="full-transcript">{detail.data.transcript}</p>
                <audio
                  controls
                  src={detail.data.audioUrl}
                  onPlay={() => audio.current?.pause()}
                />
                <small className="muted">
                  {detail.data.transcriptSource === "reference"
                    ? "사용자가 제공한 대본입니다. 자동 전사 결과가 아닙니다."
                    : "작성자가 직접 적은 내용입니다."}
                </small>
              </>
            ) : (
              <>
                <p className="muted">
                  {time(detail.data.duration)} · 가족의 실제 목소리{" "}
                  {detail.data.sourceMessageIds.length}개
                </p>
                <div className="chapter-list">
                  {detail.data.chapters.map((chapter, i) => (
                    <button
                      key={i}
                      className={`chapter ${chapter.kind}`}
                      onClick={() => chooseChapter(detail.data, chapter.start)}
                    >
                      <span>{time(chapter.start)}</span>
                      <div>
                        <strong>
                          {chapter.kind === "family"
                            ? `${chapter.author} · ${chapter.label}`
                            : chapter.label}
                        </strong>
                        <p>{chapter.text || chapter.transcript}</p>
                      </div>
                      {chapter.kind === "family" && (
                        <Icon name="mic" size={16} />
                      )}
                    </button>
                  ))}
                </div>
                <div className="detail-actions">
                  <a
                    className="button dark"
                    href={detail.data.audioUrl}
                    download="우리차FM.m4a"
                  >
                    <Icon name="download" size={17} /> 방송 저장
                  </a>
                  <button
                    className="text-button danger"
                    onClick={() =>
                      setDeleteTarget({
                        type: "episodes",
                        id: detail.data.id,
                        title: detail.data.title,
                      })
                    }
                  >
                    방송 삭제
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
      {deleteTarget && (
        <Modal title="삭제할까요?" onClose={() => setDeleteTarget(null)}>
          <div className="delete-content">
            <h3>{deleteTarget.title}</h3>
            <p>
              {deleteTarget.type === "messages"
                ? "앱에 저장된 녹음과 이 사연이 포함된 방송을 함께 삭제합니다. 별도로 내려받은 파일은 직접 삭제해주세요."
                : "완성된 방송 파일을 삭제합니다. 원본 사연은 보관함에 남습니다."}
            </p>
            <div className="detail-actions">
              <button
                className="button light"
                onClick={() => setDeleteTarget(null)}
              >
                취소
              </button>
              <button className="button coral" onClick={remove}>
                삭제하기
              </button>
            </div>
          </div>
        </Modal>
      )}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div className="toast">
            <Icon name="check" size={18} />
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  const box = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const focusable = () => [
      ...box.current.querySelectorAll(
        "button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled)",
      ),
    ];
    focusable()[0]?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const elements = focusable(),
          first = elements[0],
          last = elements.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="modal"
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <button className="round-button" onClick={onClose} aria-label="닫기">
            <Icon name="close" />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function BuildDialog({ messages, status, job, setJob, onClose }) {
  const [chosen, setChosen] = useState(messages.map((m) => m.id)),
    [target, setTarget] = useState(300),
    [mode, setMode] = useState(status?.ai.available ? "local_ai" : "basic");
  const [error, setError] = useState(""),
    [submitting, setSubmitting] = useState(false);
  const busy = job && !["ready", "failed"].includes(job.stage);
  async function generate() {
    setSubmitting(true);
    setError("");
    try {
      const j = await api("/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageIds: chosen,
          targetSeconds: target,
          mode,
        }),
      });
      setJob(j);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <Modal title="우리 방송 만들기" onClose={onClose}>
      {busy ? (
        <div className="production">
          <div className="production-record">
            <Icon name="radio" size={44} />
          </div>
          <span className="eyebrow">OUR STORIES ARE COMING TOGETHER</span>
          <h3>{job.message}</h3>
          <p>
            가족의 녹음은 그대로, DJ의 목소리는 새롭게.
            <br />이 컴퓨터에서 방송을 만들고 있어요.
          </p>
          <div className="progress-track">
            <i style={{ width: `${job.progress}%` }} />
          </div>
          <span className="muted">
            {job.progress}% · 창을 닫아도 제작은 계속돼요.
          </span>
        </div>
      ) : (
        <div className="build-body">
          <p className="muted">
            듣고 싶은 목소리를 골라 하나의 방송으로 엮어보세요.
          </p>
          <label className="field-label">얼마나 함께 들을까요?</label>
          <div className="duration-options">
            {[300, 600, 900].map((n) => (
              <button
                key={n}
                className={target === n ? "selected" : ""}
                onClick={() => setTarget(n)}
              >
                <strong>
                  {n / 60}
                  <small>분</small>
                </strong>
                <span>이내로 담기</span>
              </button>
            ))}
          </div>
          <p className="field-hint">
            사연이 짧으면 방송도 짧게. 시간을 억지로 늘리지 않아요.
          </p>
          <div className="field-row">
            <label className="field-label">
              담을 목소리 <span>{chosen.length}</span>
            </label>
            <button
              className="text-button"
              onClick={() =>
                setChosen(
                  chosen.length === messages.length
                    ? []
                    : messages.map((m) => m.id),
                )
              }
            >
              {chosen.length === messages.length ? "선택 해제" : "전체 선택"}
            </button>
          </div>
          <div className="choose-stories">
            {messages.map((m) => (
              <label className="choose-story" key={m.id}>
                <input
                  type="checkbox"
                  checked={chosen.includes(m.id)}
                  onChange={(e) =>
                    setChosen(
                      e.target.checked
                        ? messages
                            .filter(
                              (item) =>
                                item.id === m.id || chosen.includes(item.id),
                            )
                            .map((item) => item.id)
                        : chosen.filter((id) => id !== m.id),
                    )
                  }
                />
                <Avatar author={m.author} />
                <span>
                  <strong>{m.title}</strong>
                  <small>
                    {m.author} · {time(m.duration)}
                  </small>
                </span>
              </label>
            ))}
          </div>
          <label className="field-label" htmlFor="dj-mode">
            DJ 구성
          </label>
          <select
            id="dj-mode"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="local_ai" disabled={!status?.ai.available}>
              AI DJ · 사연에 맞춰 연결 멘트 작성
            </option>
            <option value="basic">기본 DJ · 정해진 소개 멘트 사용</option>
          </select>
          <p className="field-hint">
            {mode === "local_ai"
              ? "AI는 DJ 멘트만 작성하고, 사연은 실제 녹음으로 재생해요."
              : "기본 DJ는 생성형 AI를 사용하지 않습니다. 사연 원본과 기본 안내를 연결해요."}
          </p>
          {(error || job?.stage === "failed") && (
            <p className="inline-error" role="alert">
              {error || job.message}
            </p>
          )}
          <button
            className="button dark wide"
            disabled={!chosen.length || submitting}
            onClick={generate}
          >
            <Icon name="spark" size={19} />
            {submitting ? "제작 요청 중…" : "이 목소리로 방송 만들기"}
            <Icon name="arrow" size={18} />
          </button>
          <p className="local-caption">
            외부 AI 호출 없이 내 컴퓨터에서 처리합니다.
          </p>
        </div>
      )}
    </Modal>
  );
}

function RecordForm({ onSaved, onError }) {
  const [author, setAuthor] = useState("나"),
    [title, setTitle] = useState(""),
    [transcript, setTranscript] = useState(""),
    [file, setFile] = useState(null),
    [preview, setPreview] = useState("");
  const [recording, setRecording] = useState(false),
    [elapsed, setElapsed] = useState(0),
    [saving, setSaving] = useState(false),
    [formError, setFormError] = useState("");
  const recorder = useRef(null),
    stream = useRef(null),
    chunks = useRef([]),
    timer = useRef(null),
    recordButton = useRef(null);
  useEffect(
    () => () => {
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
      clearInterval(timer.current);
    },
    [],
  );
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
    clearInterval(timer.current);
    setRecording(false);
  }
  async function record() {
    if (recording) {
      stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      onError(
        "이 브라우저에서는 직접 녹음을 사용할 수 없어요. 음성 파일을 올려주세요.",
      );
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const mime = [
        "audio/mp4",
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
      ].find((t) => MediaRecorder.isTypeSupported(t));
      const instance = new MediaRecorder(
        stream.current,
        mime ? { mimeType: mime } : undefined,
      );
      recorder.current = instance;
      chunks.current = [];
      instance.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      instance.onstop = () => {
        const type = instance.mimeType || "audio/webm";
        const ext = type.includes("mp4")
          ? "m4a"
          : type.includes("ogg")
            ? "ogg"
            : "webm";
        setFile(new File(chunks.current, `나의-목소리.${ext}`, { type }));
        stream.current?.getTracks().forEach((t) => t.stop());
        clearInterval(timer.current);
        setRecording(false);
      };
      instance.start();
      setElapsed(0);
      setRecording(true);
      timer.current = setInterval(
        () =>
          setElapsed((t) => {
            if (t >= 359) {
              stop();
              return 360;
            }
            return t + 1;
          }),
        1000,
      );
    } catch {
      stream.current?.getTracks().forEach((t) => t.stop());
      onError("마이크 사용을 허용해주세요. 또는 녹음 파일을 올릴 수 있어요.");
    }
  }
  async function submit(e) {
    e.preventDefault();
    if (!file) {
      setFormError("목소리를 녹음하거나 파일을 올려주세요.");
      return;
    }
    setSaving(true);
    setFormError("");
    const body = new FormData();
    body.set("author", author);
    body.set("title", title);
    body.set("transcript", transcript);
    body.set("audio", file);
    try {
      await api("/messages", { method: "POST", body });
      await onSaved();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="record-page">
      <section className="page-intro">
        <div>
          <span className="eyebrow">LEAVE A LITTLE OF YOUR DAY</span>
          <h2>
            대단한 이야기보다,
            <br />
            그냥 오늘의 목소리.
          </h2>
          <p>
            밥은 먹었는지, 오늘은 어땠는지.
            <br />
            짧은 안부도 충분해요.
          </p>
        </div>
        <div className="record-doodle">
          <Icon name="mic" size={62} />
          <span>
            your voice
            <br />
            is enough.
          </span>
        </div>
      </section>
      <form className="record-layout" onSubmit={submit}>
        <section className="record-box card">
          <span className="eyebrow">01 · 목소리 담기</span>
          <h3>말로 남겨볼까요?</h3>
          <p className="muted">한 번에 6분까지 녹음할 수 있어요.</p>
          <button
            type="button"
            ref={recordButton}
            className={`record-button ${recording ? "recording" : ""}`}
            aria-label={recording ? "녹음 마치기" : "녹음 시작"}
            onClick={record}
          >
            {recording ? (
              <span className="stop-square" />
            ) : (
              <Icon name="mic" size={32} />
            )}
          </button>
          <strong className="record-timer">
            {recording
              ? time(elapsed)
              : file
                ? "목소리가 준비됐어요"
                : "버튼을 눌러 녹음 시작"}
          </strong>
          <span className="muted">
            {recording
              ? "한 번 더 누르면 녹음이 끝나요."
              : "조용한 곳에서 편하게 이야기해주세요."}
          </span>
          <div className="upload-divider">
            <span />
            또는
            <span />
          </div>
          <label className={`upload-file ${recording ? "disabled" : ""}`}>
            <Icon name="upload" size={18} />
            {file ? file.name : "가지고 있는 음성 파일 올리기"}
            <input
              type="file"
              accept="audio/*,.m4a,.webm,.wav,.mp3,.ogg"
              disabled={recording || saving}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  if (f.size > 25 * 1024 * 1024) {
                    onError("파일은 25MB 이하로 올려주세요.");
                    return;
                  }
                  setFile(f);
                }
              }}
            />
          </label>
          <small className="field-hint">
            M4A · MP3 · WAV · WebM · 25MB 이하
          </small>
          {preview && (
            <audio className="record-preview" controls src={preview} />
          )}
        </section>
        <section className="record-fields card">
          <span className="eyebrow">02 · 이야기 소개</span>
          <h3>누가, 어떤 이야기를 남겼나요?</h3>
          <label className="field-label" htmlFor="author">
            목소리를 남긴 사람
          </label>
          <input
            id="author"
            value={author}
            maxLength={20}
            required
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="예: 나, 친구, 엄마"
          />
          <label className="field-label" htmlFor="story-title">
            짧은 제목
          </label>
          <input
            id="story-title"
            value={title}
            maxLength={60}
            required
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 오늘 발표, 드디어 끝났어!"
          />
          <label className="field-label" htmlFor="transcript">
            녹음에서 말한 내용
          </label>
          <textarea
            id="transcript"
            value={transcript}
            maxLength={4000}
            required
            rows={6}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="DJ가 이야기를 소개할 수 있도록 말한 내용을 적어주세요."
          />
          <p className="field-hint">
            현재 버전은 자동 전사 대신 직접 적은 내용을 사용합니다.
          </p>
          {formError && (
            <p className="inline-error" role="alert">
              {formError}
            </p>
          )}
          <button
            className="button dark wide"
            disabled={saving || recording}
            type="submit"
          >
            <Icon name="heart" size={18} />
            {saving ? "목소리를 담고 있어요…" : "이 목소리 남기기"}
            <Icon name="arrow" size={18} />
          </button>
          <p className="local-caption">녹음과 글은 이 컴퓨터에만 저장됩니다.</p>
        </section>
      </form>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
