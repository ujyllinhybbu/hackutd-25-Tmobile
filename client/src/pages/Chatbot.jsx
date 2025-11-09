import React, { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  Send,
  ChevronLeft,
  User,
  MapPin,
  ClipboardList,
  FileText,
  Loader2,
  AlertCircle,
} from "lucide-react";

/** --- THEME (T-Mobile) --- */
const T = {
  magenta: "#E20074",
  magentaLight: "#FF77C8",
  surface: "rgba(255,255,255,0.72)",
  surface2: "rgba(255,255,255,0.88)",
  stroke: "rgba(255,255,255,0.35)",
  ink: "#0f172a",
};

const STORAGE_KEYS = {
  ticketId: "tm_ticket_id",
  requesterName: "tm_requester_name",
};

export default function Chatbot() {
  /* ---------------- State ---------------- */
  const [name, setName] = useState(
    () => localStorage.getItem(STORAGE_KEYS.requesterName) || ""
  );
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

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]); // [{authorType, authorName, text, createdAt}]
  const [loadingHistory, setLoadingHistory] = useState(false);

  const listRef = useRef(null);
  const socketRef = useRef(null);
  const joinRetryTimerRef = useRef(null);
  const joinedRoomRef = useRef(null);

  // self-send buffer to ignore echoed 'chat:new'
  const selfBufferRef = useRef([]);
  const pruneSelf = () => {
    const now = Date.now();
    selfBufferRef.current = selfBufferRef.current.filter(
      (s) => now - s.at <= 2000
    );
  };

  /* ---------------- Helpers ---------------- */
  const setTicketAndPersist = (id) => {
    const tid = String(id);
    setTicketId(tid);
    localStorage.setItem(STORAGE_KEYS.ticketId, tid);

    const u = new URL(location.href);
    u.searchParams.set("id", tid);
    history.replaceState({}, "", u);
  };

  const scrollToBottom = () => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  const addMsg = (m) => {
    setMessages((prev) => [...prev, m]);
  };

  const loadHistory = async (tid) => {
    if (!tid) return;
    setLoadingHistory(true);
    try {
      // Prefer /chat; fallback to /messages
      let res = await fetch(`/api/tickets/${tid}/chat`);
      if (!res.ok) {
        res = await fetch(`/api/tickets/${tid}/messages`);
      }
      const data = await res.json().catch(() => null);
      // Supported shapes:
      // { success: true, messages: [...] }  OR  [...]
      const msgs = Array.isArray(data) ? data : data?.messages || [];
      setMessages(msgs);
    } catch (e) {
      console.error("History load failed:", e);
    } finally {
      setLoadingHistory(false);
      setTimeout(scrollToBottom, 50);
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
    // create socket (same origin)
    if (socketRef.current) return;
    const socket = io({
      autoConnect: true,
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      if (ticketId) {
        startJoinRetry();
        loadHistory(ticketId);
      }
    });

    socket.io.on("reconnect", () => {
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
      setTimeout(scrollToBottom, 10);
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

  /* ---------------- Effects ---------------- */
  useEffect(() => {
    // autoscroll on new messages
    scrollToBottom();
  }, [messages.length, loadingHistory]);

  /* ---------------- Actions ---------------- */
  const startChat = async () => {
    setError("");
    const requesterName = name.trim() || "Guest";
    const c = city.trim() || "Unknown";
    const t = title.trim() || "Issue";
    const d = description.trim() || "";

    if (!t || !d) {
      setError("Please provide an issue title and short description.");
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
      localStorage.setItem(STORAGE_KEYS.requesterName, requesterName);

      setTicketAndPersist(data.ticket._id);
      setStatusText(`Status: ${data.ticket.status || "open"}`);

      // ensure socket is up and joining
      if (socketRef.current?.connected) {
        startJoinRetry();
      }

      // history includes the welcome bot message
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
    addMsg({
      authorType: "user",
      authorName,
      text,
      createdAt: new Date(now).toISOString(),
    });
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

  /* ---------------- UI ---------------- */
  const TicketPill = () =>
    ticketId ? (
      <span
        className="pill inline-block px-3 py-1 rounded-full text-xs border"
        style={{ background: T.surface2, borderColor: T.stroke, color: T.ink }}
      >
        Ticket: <b className="ml-1">{ticketId}</b>
      </span>
    ) : null;

  const StatusPill = () =>
    statusText ? (
      <span
        className="pill inline-block px-3 py-1 rounded-full text-xs border"
        style={{ background: T.surface2, borderColor: T.stroke, color: T.ink }}
      >
        {statusText}
      </span>
    ) : null;

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "radial-gradient(1200px 700px at -10% -10%, rgba(226,0,116,0.08), transparent 50%), radial-gradient(1200px 700px at 110% 10%, rgba(255,119,200,0.08), transparent 50%), linear-gradient(to bottom right, #ffffff, #f8fafc)",
      }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-10 border-b backdrop-blur-xl"
        style={{ background: "rgba(255,255,255,0.75)", borderColor: T.stroke }}
      >
        <div className="mx-auto max-w-4xl px-4 sm:px-6 md:px-8 py-3 flex items-center justify-between">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium"
            style={{ color: T.magenta }}
          >
            <ChevronLeft className="h-4 w-4" />
            Dashboard
          </a>
          <div className="text-center">
            <div
              className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background: "rgba(226,0,116,0.12)", color: T.magenta }}
            >
              📲 Customer Support Chat
            </div>
            <h1
              className="mt-1 text-lg sm:text-xl font-extrabold tracking-tight"
              style={{
                backgroundImage: `linear-gradient(90deg, ${T.magenta}, ${T.magentaLight})`,
                WebkitBackgroundClip: "text",
                color: "transparent",
              }}
            >
              Open a Ticket & Chat Live
            </h1>
          </div>
          <div />
        </div>
      </header>

      {/* Body */}
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
              <label className="text-xs text-slate-600">Your name</label>
              <div
                className="flex items-center gap-2 border rounded-xl px-3 h-11 bg-white/90"
                style={{ borderColor: T.stroke }}
              >
                <User className="h-4 w-4 text-slate-500" />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Erick"
                  className="flex-1 bg-transparent outline-none text-sm"
                />
              </div>
            </div>

            <div className="w-full sm:w-[220px]">
              <label className="text-xs text-slate-600">City</label>
              <div
                className="flex items-center gap-2 border rounded-xl px-3 h-11 bg-white/90"
                style={{ borderColor: T.stroke }}
              >
                <MapPin className="h-4 w-4 text-slate-500" />
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Dallas"
                  className="flex-1 bg-transparent outline-none text-sm"
                />
              </div>
            </div>

            <div className="w-full sm:w-[220px]">
              <label className="text-xs text-slate-600">
                Severity (optional)
              </label>
              <div
                className="flex items-center gap-2 border rounded-xl px-3 h-11 bg-white/90"
                style={{ borderColor: T.stroke }}
              >
                <ClipboardList className="h-4 w-4 text-slate-500" />
                <select
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

            <div className="w-full sm:w-1/2">
              <label className="text-xs text-slate-600">Issue title</label>
              <div
                className="flex items-center gap-2 border rounded-xl px-3 h-11 bg-white/90"
                style={{ borderColor: T.stroke }}
              >
                <FileText className="h-4 w-4 text-slate-500" />
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="No signal near downtown"
                  className="flex-1 bg-transparent outline-none text-sm"
                />
              </div>
            </div>

            <div className="w-full sm:w-1/2">
              <label className="text-xs text-slate-600">
                Short description
              </label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Can't make calls since last night"
                className="w-full rounded-xl border px-3 h-11 bg-white/90 outline-none text-sm"
                style={{ borderColor: T.stroke }}
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={startChat}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl text-white px-4 py-2 font-medium transition"
                style={{
                  background: T.magenta,
                  boxShadow: "0 8px 22px rgba(226,0,116,0.35)",
                }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Starting…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Start Chat
                  </>
                )}
              </button>

              <TicketPill />
              <StatusPill />
            </div>
          </div>

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
            </div>
          )}

          <div
            className="my-4 h-px"
            style={{ background: "rgba(30,41,59,0.35)" }}
          />

          {/* Chat area */}
          <div>
            <div
              ref={listRef}
              className="rounded-2xl border p-3 sm:p-4 h-[360px] overflow-y-auto"
              style={{
                background: "rgba(255,255,255,0.65)",
                borderColor: T.stroke,
              }}
            >
              {loadingHistory ? (
                <div className="text-sm text-slate-600">Loading history…</div>
              ) : messages.length === 0 ? (
                <div className="text-sm text-slate-600">
                  {ticketId
                    ? "Say hello! A specialist will join shortly."
                    : "Fill the form and click Start Chat to begin."}
                </div>
              ) : (
                <div className="space-y-2">
                  {messages.map((m, idx) => {
                    const ts = m.createdAt
                      ? new Date(m.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "";
                    const tone =
                      m.authorType === "user"
                        ? { color: "#f472b6" }
                        : m.authorType === "staff"
                        ? { color: "#22c55e" }
                        : { color: "#a78bfa" }; // bot
                    return (
                      <div key={idx} className="text-sm">
                        <div className="font-semibold" style={tone}>
                          [{m.authorType}] {m.authorName || ""}{" "}
                          <span className="text-xs text-slate-500">{ts}</span>
                        </div>
                        <div className="text-slate-800 whitespace-pre-wrap">
                          {m.text}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Composer */}
            <div
              className="mt-2 flex items-end gap-2 rounded-2xl border p-2 sm:p-3"
              style={{ background: T.surface2, borderColor: T.stroke }}
            >
              <textarea
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
              />
              <button
                onClick={sendMessage}
                disabled={!ticketId || !input.trim()}
                className="inline-flex items-center gap-2 rounded-xl text-white px-4 py-2 font-medium transition disabled:opacity-50"
                style={{
                  background: T.magenta,
                  boxShadow: "0 8px 22px rgba(226,0,116,0.35)",
                }}
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
