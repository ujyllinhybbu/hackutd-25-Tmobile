import React, { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  Send,
  User,
  MapPin,
  ClipboardList,
  FileText,
  Loader2,
  AlertCircle,
  WifiOff,
  Wifi,
  ArrowDown,
  X,
  Sparkles,
} from "lucide-react";

/** --- THEME (T-Mobile) --- */
const T = {
  magenta: "#E20074",
  magentaLight: "#FF77C8",
  surface: "rgba(255,255,255,0.72)",
  surface2: "rgba(255,255,255,0.88)",
  stroke: "rgba(30,41,59,0.25)",
  ink: "#0f172a",
};

const STORAGE_KEYS = {
  ticketId: "tm_ticket_id",
  requesterName: "tm_requester_name",
  draft: "tm_chat_draft",
  intake: "tm_intake_draft",
};

/**
 * Small hooks & helpers
 */
const useLocal = (key, initial = "") => {
  const [v, setV] = useState(() => localStorage.getItem(key) ?? initial);
  useEffect(() => {
    if (v === undefined || v === null) return;
    localStorage.setItem(key, String(v));
  }, [key, v]);
  return [v, setV];
};

const useAutoResize = (ref, max = 180) => {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, max) + "px";
    };
    handler();
    el.addEventListener("input", handler);
    return () => el.removeEventListener("input", handler);
  }, [ref, max]);
};

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

const timeLabel = (d) =>
  d
    ? new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

const groupByDay = (msgs = []) => {
  const out = [];
  let day = "";
  for (const m of msgs) {
    const k = m.createdAt ? new Date(m.createdAt).toDateString() : "";
    if (k !== day) {
      day = k;
      out.push({ _type: "day", key: k });
    }
    out.push(m);
  }
  return out;
};

export default function Chatbot() {
  /* ---------------- State ---------------- */
  const [name, setName] = useLocal(STORAGE_KEYS.requesterName, "");
  const [city, setCity] = useState("");
  const [severity, setSeverity] = useState("minor");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [ticketId, setTicketId] = useState(() => {
    const qs = new URLSearchParams(location.search).get("id");
    return qs || localStorage.getItem(STORAGE_KEYS.ticketId) || "";
  });
  const [statusText, setStatusText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [input, setInput] = useLocal(STORAGE_KEYS.draft, "");
  const [messages, setMessages] = useState([]); // [{authorType, authorName, text, createdAt}]
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [connected, setConnected] = useState(false);
  const [unread, setUnread] = useState(0);

  const listRef = useRef(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const socketRef = useRef(null);
  const joinRetryTimerRef = useRef(null);
  const atBottomRef = useRef(true);
  const joinedRoomRef = useRef(null);

  // self-send buffer to ignore echoed 'chat:new'
  const selfBufferRef = useRef([]);
  const pruneSelf = () => {
    const now = Date.now();
    selfBufferRef.current = selfBufferRef.current.filter(
      (s) => now - s.at <= 2000
    );
  };

  useAutoResize(inputRef);

  /* ---------------- Validation ---------------- */
  const titleOk = title.trim().length >= 6;
  const descOk = description.trim().length >= 10;
  const canStart = titleOk && descOk && !submitting;

  /* ---------------- Helpers ---------------- */
  const setTicketAndPersist = (id) => {
    const tid = String(id);
    setTicketId(tid);
    localStorage.setItem(STORAGE_KEYS.ticketId, tid);

    const u = new URL(location.href);
    u.searchParams.set("id", tid);
    history.replaceState({}, "", u);
  };

  const scrollToBottom = (smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  };

  const addMsg = (m) => setMessages((prev) => [...prev, m]);

  const loadHistory = async (tid) => {
    if (!tid) return;
    setLoadingHistory(true);
    try {
      let res = await fetch(`/api/tickets/${tid}/chat`);
      if (!res.ok) res = await fetch(`/api/tickets/${tid}/messages`);
      const data = await res.json().catch(() => null);
      const msgs = Array.isArray(data) ? data : data?.messages || [];
      setMessages(msgs);
      setTimeout(() => scrollToBottom(false), 40);
    } catch (e) {
      console.error("History load failed:", e);
    } finally {
      setLoadingHistory(false);
    }
  };

  /* ---------------- Socket wiring ---------------- */
  const startJoinRetry = () => {
    stopJoinRetry();
    joinOnce();
    joinRetryTimerRef.current = setInterval(joinOnce, 2000);
  };
  const stopJoinRetry = () => {
    if (joinRetryTimerRef.current) {
      clearInterval(joinRetryTimerRef.current);
      joinRetryTimerRef.current = null;
    }
  };
  const joinOnce = () => {
    if (!socketRef.current || !ticketId) return;
    socketRef.current.emit("join", { role: "user", ticketId });
  };

  useEffect(() => {
    if (socketRef.current) return;
    const socket = io({
      autoConnect: true,
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      if (ticketId) {
        startJoinRetry();
        loadHistory(ticketId);
      }
    });

    socket.on("disconnect", () => setConnected(false));

    socket.io.on("reconnect", () => {
      setConnected(true);
      joinedRoomRef.current = null;
      if (ticketId) {
        startJoinRetry();
        loadHistory(ticketId);
      }
    });

    socket.on("joined", (d) => {
      joinedRoomRef.current = d.room;
      if (d.room === `ticket:${ticketId}`) stopJoinRetry();
    });

    socket.on("chat:new", (m) => {
      if (String(m.ticketId) !== String(ticketId)) return;
      if (m.authorType === "user") {
        pruneSelf();
        const i = selfBufferRef.current.findIndex(
          (s) =>
            s.authorName === m.authorName &&
            s.text === m.text &&
            Math.abs(new Date(m.createdAt).getTime() - s.at) < 2000
        );
        if (i !== -1) {
          selfBufferRef.current.splice(i, 1);
          return;
        }
      }
      addMsg(m);
      if (!atBottomRef.current) setUnread((n) => n + 1);
      else setTimeout(() => scrollToBottom(true), 10);
    });

    socket.on("ticket:updated", (p) => {
      if (p?.id && String(p.id) === String(ticketId) && p.status) {
        setStatusText(`Status: ${p.status}`);
      }
    });

    socket.on("ticket:closed", (t) => {
      if (t?._id && String(t._id) === String(ticketId)) {
        setStatusText("Status: fixed");
      }
    });

    socket.on("connect_error", (err) =>
      console.warn("socket connect_error", err)
    );
    socket.on("error", (err) => console.warn("socket error", err));

    return () => {
      stopJoinRetry();
      try {
        socket.disconnect();
      } catch {}
      socketRef.current = null;
    };
  }, [ticketId]);

  /* ---------------- Scroll tracking ---------------- */
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
      atBottomRef.current = atBottom;
      if (atBottom) setUnread(0);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  /* ---------------- Effects ---------------- */
  useEffect(() => {
    // focus textarea after starting chat
    if (ticketId) inputRef.current?.focus();
  }, [ticketId]);

  /* ---------------- Actions ---------------- */
  const startChat = async () => {
    setError("");
    const requesterName = name.trim() || "Guest";
    const c = city.trim() || "Unknown";
    const t = title.trim();
    const d = description.trim();

    if (!titleOk || !descOk) {
      setError(
        "Add a clear title (≥6 chars) and a short description (≥10 chars)."
      );
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterName,
          city: c,
          title: t,
          description: d,
          severity,
        }),
      });

      const data = await res.json();
      if (!data?.success) {
        setError(data?.error || "Failed to create ticket.");
        return;
      }

      setTicketAndPersist(data.ticket._id);
      setMessages([]);
      setStatusText(`Status: ${data.ticket.status || "open"}`);

      // ensure socket is up and joining
      if (socketRef.current?.connected) startJoinRetry();

      await loadHistory(data.ticket._id);
    } catch (e) {
      console.error(e);
      setError("Network error creating ticket.");
    } finally {
      setSubmitting(false);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;
    if (!ticketId) {
      addMsg({
        authorType: "bot",
        authorName: "AutoBot",
        text: "No ticket active. Click Start Chat.",
        createdAt: new Date().toISOString(),
      });
      setInput("");
      return;
    }
    const authorName = name.trim() || "You";
    setInput("");

    // optimistic render
    const now = Date.now();
    const optimistic = {
      authorType: "user",
      authorName,
      text,
      createdAt: new Date(now).toISOString(),
    };
    addMsg(optimistic);
    selfBufferRef.current.push({ text, authorName, at: now });
    pruneSelf();

    try {
      const res = await fetch(`/api/tickets/${ticketId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorType: "user",
          authorName: name.trim() || "Guest",
          text,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        addMsg({
          authorType: "bot",
          authorName: "AutoBot",
          text: `⚠️ Failed to send (${res.status}): ${
            body?.message || body?.error || "unknown error"
          }`,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      addMsg({
        authorType: "bot",
        authorName: "AutoBot",
        text: "⚠️ Network error while sending. Please try again.",
        createdAt: new Date().toISOString(),
      });
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /* ---------------- UI bits ---------------- */
  const Pill = ({ children }) => (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border"
      style={{ background: T.surface2, borderColor: T.stroke, color: T.ink }}
    >
      {children}
    </span>
  );

  const TicketPill = () =>
    ticketId ? (
      <Pill>
        Ticket: <b className="ml-1">{ticketId}</b>
      </Pill>
    ) : null;
  const StatusPill = () => (statusText ? <Pill>{statusText}</Pill> : null);

  const ConnectionBanner = () => (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-20 -mt-4 mb-2 rounded-xl border px-3 py-2 text-xs flex items-center gap-2"
      style={{
        background: connected ? "#effdf5" : "#fff5f5",
        borderColor: connected
          ? "rgba(16,185,129,0.35)"
          : "rgba(239,68,68,0.35)",
        color: connected ? "#047857" : "#b91c1c",
      }}
    >
      {connected ? (
        <Wifi className="h-4 w-4" />
      ) : (
        <WifiOff className="h-4 w-4" />
      )}
      {connected
        ? "Connected to support"
        : "Disconnected — messages will send when reconnected"}
    </div>
  );

  const NewBadge = () =>
    unread > 0 ? (
      <button
        onClick={() => scrollToBottom(true)}
        className="group absolute left-1/2 -translate-x-1/2 -top-4 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border shadow"
        style={{ background: "#fff", borderColor: T.stroke }}
      >
        <ArrowDown className="h-3.5 w-3.5" /> {unread} new
      </button>
    ) : null;

  const EmptyState = () => (
    <div className="text-sm text-slate-600 flex flex-col items-center justify-center h-full text-center select-none">
      <Sparkles className="h-6 w-6 mb-2 opacity-70" />
      {ticketId ? (
        <>
          <p>Say hello! A specialist will join shortly.</p>
          <p className="text-[11px] mt-1">
            Tip: Include details like device, zip, and steps tried.
          </p>
        </>
      ) : (
        <>
          <p>
            Fill the form and click <b>Start Chat</b> to begin.
          </p>
          <p className="text-[11px] mt-1">
            We’ll open a ticket and keep everything in one place.
          </p>
        </>
      )}
    </div>
  );

  const intakeHelp = (
    <div
      className="grid sm:grid-cols-2 gap-2 text-[11px] text-slate-600"
      aria-hidden
    >
      <div className="rounded-lg border p-2" style={{ borderColor: T.stroke }}>
        <div className="font-semibold mb-1">Good title</div>
        <div>"No signal near Deep Ellum since 10pm"</div>
      </div>
      <div className="rounded-lg border p-2" style={{ borderColor: T.stroke }}>
        <div className="font-semibold mb-1">Helpful description</div>
        <div>
          "Pixel 8, 75201, tried reboot + airplane mode, still SOS only"
        </div>
      </div>
    </div>
  );

  const chars = (v) => clamp(v.length, 0, 200);

  /* ---------------- Render ---------------- */
  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "radial-gradient(1200px 700px at -10% -10%, rgba(226,0,116,0.08), transparent 50%), radial-gradient(1200px 700px at 110% 10%, rgba(255,119,200,0.08), transparent 50%), linear-gradient(to bottom right, #ffffff, #f8fafc)",
      }}
    >
      <main className="mx-auto max-w-4xl px-4 sm:px-6 md:px-8 py-4">
        <section
          className="rounded-2xl border p-4 sm:p-5"
          style={{
            background: T.surface,
            borderColor: T.stroke,
            boxShadow: "0 8px 26px rgba(226,0,116,0.15)",
          }}
        >
          {/* Intake Row */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label htmlFor="name" className="text-xs text-slate-600">
                Your name
              </label>
              <div
                className="flex items-center gap-2 border rounded-xl px-3 h-11 bg-white/90"
                style={{ borderColor: T.stroke }}
              >
                <User className="h-4 w-4 text-slate-500" />
                <input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Erick"
                  className="flex-1 bg-transparent outline-none text-sm"
                  autoComplete="name"
                />
              </div>
            </div>

            <div className="w-full sm:w-[220px]">
              <label htmlFor="city" className="text-xs text-slate-600">
                City
              </label>
              <div
                className="flex items-center gap-2 border rounded-xl px-3 h-11 bg-white/90"
                style={{ borderColor: T.stroke }}
              >
                <MapPin className="h-4 w-4 text-slate-500" />
                <input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Dallas"
                  className="flex-1 bg-transparent outline-none text-sm"
                  autoComplete="address-level2"
                />
              </div>
            </div>

            <div className="w-full sm:w-[220px]">
              <label htmlFor="sev" className="text-xs text-slate-600">
                Severity (optional)
              </label>
              <div
                className="flex items-center gap-2 border rounded-xl px-3 h-11 bg-white/90"
                style={{ borderColor: T.stroke }}
              >
                <ClipboardList className="h-4 w-4 text-slate-500" />
                <select
                  id="sev"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-sm"
                >
                  <option value="minor">minor</option>
                  <option value="major">major</option>
                  <option value="critical">critical</option>
                </select>
              </div>
            </div>

            <div className="w-full sm:flex-1">
              <label
                htmlFor="title"
                className="text-xs text-slate-600 flex items-center justify-between"
              >
                <span>Issue title</span>
                <span
                  className={`tabular-nums ${
                    titleOk ? "text-slate-400" : "text-rose-600"
                  }`}
                >
                  {chars(title)}/200
                </span>
              </label>
              <div
                className={`flex items-center gap-2 border rounded-xl px-3 h-11 bg-white/90 ${
                  titleOk ? "" : "ring-1 ring-rose-300"
                }`}
                style={{ borderColor: T.stroke }}
              >
                <FileText className="h-4 w-4 text-slate-500" />
                <input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, 200))}
                  placeholder="No signal near downtown"
                  className="flex-1 bg-transparent outline-none text-sm"
                />
              </div>
            </div>

            <div className="w-full sm:flex-1">
              <label
                htmlFor="desc"
                className="text-xs text-slate-600 flex items-center justify-between"
              >
                <span>Short description</span>
                <span
                  className={`tabular-nums ${
                    descOk ? "text-slate-400" : "text-rose-600"
                  }`}
                >
                  {chars(description)}/200
                </span>
              </label>
              <input
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 200))}
                placeholder="Can't make calls since last night"
                className={`w-full rounded-xl border px-3 h-11 bg-white/90 outline-none text-sm ${
                  descOk ? "" : "ring-1 ring-rose-300"
                }`}
                style={{ borderColor: T.stroke }}
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={startChat}
                disabled={!canStart}
                className="inline-flex items-center gap-2 rounded-xl text-white px-4 py-2 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: T.magenta,
                  boxShadow: "0 8px 22px rgba(226,0,116,0.35)",
                }}
                aria-disabled={!canStart}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Starting…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" /> Start Chat
                  </>
                )}
              </button>

              <TicketPill />
              <StatusPill />
            </div>
          </div>

          {/* Helper examples */}
          <div className="mt-2">{intakeHelp}</div>

          {error && (
            <div
              className="mt-3 rounded-xl border p-3 text-sm flex items-start gap-2"
              style={{
                borderColor: "rgba(239,68,68,0.35)",
                background: "#fff0f0",
                color: "#b91c1c",
              }}
            >
              <AlertCircle className="h-4 w-4 mt-0.5" />
              <span>{error}</span>
              <button
                onClick={() => setError("")}
                className="ml-auto opacity-70 hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div
            className="my-4 h-px"
            style={{ background: "rgba(30,41,59,0.35)" }}
          />

          {/* Chat area */}
          <div>
            <ConnectionBanner />

            <div
              ref={listRef}
              className="relative rounded-2xl border p-3 sm:p-4 h-[420px] overflow-y-auto"
              style={{
                background: "rgba(255,255,255,0.65)",
                borderColor: T.stroke,
              }}
            >
              <div className="absolute left-0 right-0 flex justify-center pointer-events-none">
                <NewBadge />
              </div>

              {loadingHistory ? (
                <div className="text-sm text-slate-600">Loading history…</div>
              ) : messages.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="space-y-3">
                  {groupByDay(messages).map((m, idx) => {
                    if (m._type === "day") {
                      return (
                        <div
                          key={`day-${idx}`}
                          className="sticky top-2 z-10 flex justify-center"
                        >
                          <span
                            className="text-[11px] px-2 py-0.5 rounded-full border bg-white/90"
                            style={{ borderColor: T.stroke }}
                          >
                            {m.key}
                          </span>
                        </div>
                      );
                    }
                    const tone =
                      m.authorType === "user"
                        ? {
                            bg: "#fdf2f8",
                            border: "#fbcfe8",
                            heading: "#be185d",
                          }
                        : m.authorType === "staff"
                        ? {
                            bg: "#ecfdf5",
                            border: "#bbf7d0",
                            heading: "#065f46",
                          }
                        : {
                            bg: "#eef2ff",
                            border: "#c7d2fe",
                            heading: "#4338ca",
                          };
                    return (
                      <div key={idx} className="text-sm">
                        <div
                          className="rounded-xl border p-2"
                          style={{
                            background: tone.bg,
                            borderColor: tone.border,
                          }}
                        >
                          <div
                            className="font-semibold flex items-center gap-2"
                            style={{ color: tone.heading }}
                          >
                            <span>
                              [{m.authorType}] {m.authorName || ""}
                            </span>
                            <span className="text-xs text-slate-500 ml-auto">
                              {timeLabel(m.createdAt)}
                            </span>
                          </div>
                          <div className="text-slate-800 whitespace-pre-wrap mt-0.5">
                            {m.text}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Composer */}
            <div
              className="mt-2 flex items-end gap-2 rounded-2xl border p-2 sm:p-3 sticky bottom-2 backdrop-blur"
              style={{ background: T.surface2, borderColor: T.stroke }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder={
                  ticketId
                    ? "Type a message… (Enter to send, Shift+Enter for newline)"
                    : "Start a chat first"
                }
                disabled={!ticketId}
                className="flex-1 resize-none bg-transparent outline-none text-sm sm:text-base max-h-40 leading-6"
                aria-label="Message"
              />
              <button
                onClick={sendMessage}
                disabled={!ticketId || !input.trim()}
                className="inline-flex items-center gap-2 rounded-xl text-white px-4 py-2 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: T.magenta,
                  boxShadow: "0 8px 22px rgba(226,0,116,0.35)",
                }}
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">Send</span>
              </button>
            </div>

            <div className="mt-2 text-[11px] sm:text-xs text-slate-500">
              Staff subscribed to the <code>support</code> room see your
              messages in real time.
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
