import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Send,
  Mic,
  Paperclip,
  Trash2,
  Sparkles,
  Bot,
  User,
  ChevronLeft,
  Loader2,
} from "lucide-react";

/** --- THEME (T-Mobile) --- */
const TMOBILE = {
  magenta: "#E20074",
  magentaLight: "#FF77C8",
  magentaSoft: "#FF9AD5",
  surface: "rgba(255,255,255,0.72)",
  stroke: "rgba(255,255,255,0.35)",
  grid: "rgba(0,0,0,0.08)",
  ink: "#0f172a",
};

const SUGGESTED = [
  "Why is my bill higher this month?",
  "My data is slow in Dallas. Any outages?",
  "Help me troubleshoot a device issue.",
  "Change my plan and add a new line.",
];

const STORAGE_KEY = "tmobile_chat_messages_v1";

/** Message bubble component */
function Bubble({ role, text, ts }) {
  const isUser = role === "user";
  return (
    <div
      className={`max-w-[85%] sm:max-w-[70%] md:max-w-[60%] rounded-2xl p-3 sm:p-4 shadow-sm border
        ${isUser ? "ml-auto" : "mr-auto"}`}
      style={{
        background: isUser ? TMOBILE.magenta : "rgba(255,255,255,0.9)",
        color: isUser ? "#fff" : TMOBILE.ink,
        borderColor: isUser ? "transparent" : TMOBILE.stroke,
      }}
      aria-live="polite"
    >
      <div className="flex items-center gap-2 mb-1">
        {isUser ? (
          <User className="h-4 w-4 opacity-90" />
        ) : (
          <Bot className="h-4 w-4" color={TMOBILE.magenta} />
        )}
        <span className="text-xs opacity-70">
          {new Date(ts).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
        {text}
      </p>
    </div>
  );
}

/** Typing indicator */
function TypingDots() {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm border"
      style={{
        background: "rgba(255,255,255,0.95)",
        borderColor: TMOBILE.stroke,
        color: TMOBILE.ink,
      }}
      aria-live="polite"
    >
      <Loader2 className="h-4 w-4 animate-spin" color={TMOBILE.magenta} />
      Agent is typing…
    </div>
  );
}

export default function Chatbot() {
  const [messages, setMessages] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);
  const listRef = useRef(null);

  /** Persist to localStorage */
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  /** Auto-scroll to bottom on new message */
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  /** Placeholder: simulate a bot response after sending */
  async function fakeBotResponse(userText) {
    setIsTyping(true);
    // TODO: Replace with your real call, e.g.:
    // const res = await axios.post("/api/chat", { text: userText });
    // const botText = res.data.text;
    const canned = [
      "Thanks for the details! Let me check your account & relevant diagnostics.",
      "I can help with that. A quick reset often helps—shall I walk you through it?",
      "I’m reviewing your area’s network status and line provisioning now.",
      "I can escalate this to a specialist team and follow up via SMS or email.",
    ];
    const botText = canned[Math.floor(Math.random() * canned.length)];

    await new Promise((r) => setTimeout(r, 900 + Math.random() * 800));
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "bot", text: botText, ts: Date.now() },
    ]);
    setIsTyping(false);
  }

  /** Send a message */
  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", text, ts: Date.now() },
    ]);
    setInput("");
    try {
      await fakeBotResponse(text);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "bot",
          text: "Sorry, I couldn’t reach the server. Please try again.",
          ts: Date.now(),
        },
      ]);
      setIsTyping(false);
    }
  };

  /** Keyboard: Enter to send, Shift+Enter for newline */
  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /** Clear conversation */
  const clearAll = () => {
    if (confirm("Clear this conversation?")) {
      setMessages([]);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  /** Empty state */
  const isEmpty = messages.length === 0 && !isTyping;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background:
          "radial-gradient(1200px 700px at -10% -10%, rgba(226,0,116,0.08), transparent 50%), radial-gradient(1200px 700px at 110% 10%, rgba(255,119,200,0.08), transparent 50%), linear-gradient(to bottom right, #ffffff, #f8fafc)",
      }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-10 border-b backdrop-blur-xl"
        style={{
          background: "rgba(255,255,255,0.75)",
          borderColor: TMOBILE.stroke,
        }}
      >
        <div className="mx-auto max-w-4xl px-4 sm:px-6 md:px-8 py-3 flex items-center justify-between">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium"
            style={{ color: TMOBILE.magenta }}
          >
            <ChevronLeft className="h-4 w-4" />
            Dashboard
          </a>
          <div className="text-center">
            <div
              className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{
                background: "rgba(226,0,116,0.12)",
                color: TMOBILE.magenta,
              }}
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ background: TMOBILE.magenta }}
              />
              Live Chat
            </div>
            <h1
              className="mt-1 text-lg sm:text-xl font-extrabold tracking-tight"
              style={{
                backgroundImage: `linear-gradient(90deg, ${TMOBILE.magenta}, ${TMOBILE.magentaLight})`,
                WebkitBackgroundClip: "text",
                color: "transparent",
              }}
            >
              T-Mobile Support Assistant
            </h1>
          </div>
          <button
            onClick={clearAll}
            className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl border transition"
            style={{ borderColor: TMOBILE.stroke, color: TMOBILE.magenta }}
            title="Clear chat"
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </button>
        </div>
      </header>

      {/* Messages */}
      <main className="mx-auto max-w-4xl w-full px-4 sm:px-6 md:px-8 py-4 flex-1">
        <div
          ref={listRef}
          className="w-full h-full max-h-[calc(100dvh-260px)] sm:max-h-[calc(100dvh-240px)] overflow-y-auto rounded-2xl p-4 sm:p-6 border"
          style={{
            background: "rgba(255,255,255,0.65)",
            borderColor: TMOBILE.stroke,
            boxShadow: "0 8px 26px rgba(226,0,116,0.15)",
          }}
        >
          {/* Empty / Onboarding */}
          {isEmpty && (
            <div className="h-full min-h-[40vh] flex flex-col items-center justify-center text-center">
              <div
                className="mb-3 inline-flex items-center justify-center w-12 h-12 rounded-2xl"
                style={{ background: "rgba(226,0,116,0.12)" }}
              >
                <Sparkles color={TMOBILE.magenta} />
              </div>
              <h2
                className="text-xl sm:text-2xl font-bold"
                style={{ color: TMOBILE.ink }}
              >
                How can we help today?
              </h2>
              <p className="text-slate-600 mt-1">
                Try a quick prompt or type your question below.
              </p>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl">
                {SUGGESTED.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="text-left px-4 py-3 rounded-xl border transition hover:-translate-y-0.5"
                    style={{
                      background: "rgba(255,255,255,0.85)",
                      borderColor: TMOBILE.stroke,
                      boxShadow: "0 6px 20px rgba(226,0,116,0.12)",
                    }}
                  >
                    <span className="text-sm text-slate-800">{s}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Thread */}
          <div className="space-y-3">
            {messages.map((m) => (
              <Bubble key={m.id} role={m.role} text={m.text} ts={m.ts} />
            ))}

            {isTyping && (
              <div className="mt-2">
                <TypingDots />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Input Bar */}
      <footer
        ref={scrollRef}
        className="sticky bottom-0 border-t backdrop-blur-xl"
        style={{
          background: "rgba(255,255,255,0.85)",
          borderColor: TMOBILE.stroke,
        }}
      >
        <div className="mx-auto max-w-4xl w-full px-4 sm:px-6 md:px-8 py-3">
          <div
            className="flex items-end gap-2 sm:gap-3 rounded-2xl border p-2 sm:p-3"
            style={{ background: TMOBILE.surface, borderColor: TMOBILE.stroke }}
          >
            <button
              className="hidden sm:inline-flex items-center justify-center h-10 w-10 rounded-xl border"
              style={{ borderColor: TMOBILE.stroke }}
              title="Attach"
              // TODO: open file picker & send attachment
              onClick={() => alert("TODO: attachments")}
            >
              <Paperclip className="h-5 w-5" />
            </button>

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Type a message…"
              className="flex-1 resize-none bg-transparent outline-none text-sm sm:text-base max-h-40 leading-6"
              style={{ color: TMOBILE.ink }}
            />

            <button
              className="hidden sm:inline-flex items-center justify-center h-10 px-3 rounded-xl border"
              style={{ borderColor: TMOBILE.stroke }}
              title="Voice"
              // TODO: start/stop microphone capture
              onClick={() => alert("TODO: voice input")}
            >
              <Mic className="h-5 w-5" />
            </button>

            <button
              onClick={sendMessage}
              className="inline-flex items-center gap-2 rounded-xl text-white px-4 py-2 font-medium transition hover:-translate-y-0.5"
              style={{
                background: TMOBILE.magenta,
                boxShadow: "0 8px 22px rgba(226,0,116,0.35)",
              }}
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>

          {/* Help text */}
          <div className="mt-2 text-[11px] sm:text-xs text-slate-500">
            Press{" "}
            <kbd className="px-1.5 py-0.5 rounded border border-slate-300 bg-white">
              Enter
            </kbd>{" "}
            to send,
            <span className="mx-1" />{" "}
            <kbd className="px-1.5 py-0.5 rounded border border-slate-300 bg-white">
              Shift
            </kbd>
            +
            <kbd className="px-1.5 py-0.5 rounded border border-slate-300 bg-white">
              Enter
            </kbd>{" "}
            for a new line.
          </div>
        </div>
      </footer>
    </div>
  );
}
