import React, { useMemo, useRef, useState, useEffect } from "react";
import useSupportPanel from "../hooks/useSupportPanel";
import {
  Flag,
  Search,
  MessageSquare,
  Send,
  CheckCircle2,
  Clock,
  MapPin,
  ChevronLeft,
  Wand2,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/** T-Mobile theme */
const T = {
  magenta: "#E20074",
  magentaLight: "#FF77C8",
  surface: "rgba(255,255,255,0.70)",
  stroke: "rgba(255,255,255,0.35)",
  ink: "#0f172a",
};

/* ---------- Small UI bits ---------- */
function Pill({ children, active }) {
  return (
    <span
      className="px-2.5 py-1 rounded-full text-xs font-semibold border"
      style={{
        background: active ? "rgba(226,0,116,0.12)" : "rgba(255,255,255,0.7)",
        color: active ? T.magenta : T.ink,
        borderColor: T.stroke,
      }}
    >
      {children}
    </span>
  );
}

/* ---------- Analysis Modal ---------- */
function AnalysisModal({ open, onClose, summary }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{}}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="w-full max-w-xl rounded-2xl border shadow-2xl"
        style={{ background: "rgba(255,255,255,0.9)", borderColor: T.stroke }}
      >
        <div
          className="flex items-center justify-between p-4 border-b"
          style={{ borderColor: T.stroke }}
        >
          <div
            className="inline-flex items-center gap-2 text-sm font-semibold"
            style={{ color: T.magenta }}
          >
            <Wand2 className="h-4 w-4" />
            AI Analysis
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg:black/5"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 text-sm text-slate-800">
          <div className="font-semibold text-base">{summary.title}</div>
          <div className="grid grid-cols-2 gap-3">
            <div
              className="rounded-xl p-3 border"
              style={{ borderColor: T.stroke, background: "white" }}
            >
              <div className="text-[11px] text-slate-500">Ticket</div>
              <div>
                Severity: <b>{summary.severity}</b>
              </div>
              <div>
                Status: <b>{summary.status}</b>
              </div>
              {summary.city && (
                <div>
                  City: <b>{summary.city}</b>
                </div>
              )}
              <div>
                Age: <b>{summary.ageHuman}</b>
              </div>
              <div>
                Last Activity: <b>{summary.lastAtHuman}</b>
              </div>
            </div>
            <div
              className="rounded-xl p-3 border"
              style={{ borderColor: T.stroke, background: "white" }}
            >
              <div className="text-[11px] text-slate-500">Conversation</div>
              <div>
                Messages: <b>{summary.msgCount}</b>
              </div>
              <div>
                User Messages: <b>{summary.userCount}</b>
              </div>
              <div>
                Staff Messages: <b>{summary.staffCount}</b>
              </div>
              <div>
                Bot Messages: <b>{summary.botCount}</b>
              </div>
            </div>
          </div>

          <div
            className="rounded-xl p-3 border"
            style={{ borderColor: T.stroke, background: "white" }}
          >
            <div className="text-[11px] text-slate-500 mb-1">Signals</div>
            <ul className="list-disc pl-5 space-y-1">
              {summary.signals?.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>

          <div
            className="rounded-xl p-3 border"
            style={{ borderColor: T.stroke, background: "white" }}
          >
            <div className="text-[11px] text-slate-500 mb-1">
              Suggested Next Action
            </div>
            <div>{summary.nextAction}</div>
          </div>
        </div>

        <div
          className="p-3 border-t flex justify-end"
          style={{ borderColor: T.stroke }}
        >
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-xl text-white text-sm"
            style={{
              background: T.magenta,
              boxShadow: "0 6px 20px rgba(226,0,116,0.35)",
            }}
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ---------- Ticket Row (with Analyze + Flag) ---------- */
function TicketRow({ t, active, onClick, onAnalyze, onFlag, analyzing }) {
  const isOpen = t.status !== "fixed";
  const flagged = !!t.flagged;

  return (
    <motion.button
      onClick={onClick}
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1 }}
      whileTap={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      className="w-full text-left relative rounded-2xl border p-3 mb-3"
      style={{
        background: "rgba(255,255,255,0.95)",
        borderColor: active ? T.magenta : T.stroke,
        boxShadow: active
          ? "0 0 0 4px rgba(226,0,116,0.12)"
          : "0 6px 18px rgba(226,0,116,0.08)",
      }}
    >
      {/* Active left rail */}
      <motion.span
        layout
        animate={{
          opacity: active ? 1 : 0,
          height: active ? "100%" : "0%",
        }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="absolute left-0 top-0 w-1.5 rounded-l-2xl"
        style={{}}
      />

      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 pr-2">
          <div className="font-semibold text-slate-800 truncate">
            {t.title || "Untitled"}
          </div>
          <div className="mt-1 text-xs text-slate-600 flex items-center gap-3">
            {t.city && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {t.city}
              </span>
            )}
            {t.lastMessageAt && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(t.lastMessageAt).toLocaleString()}
              </span>
            )}
          </div>
          {t.lastMessageSnippet && (
            <div className="mt-1 text-xs text-slate-700 line-clamp-1">
              {t.lastMessageSnippet}
            </div>
          )}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 shrink-0">
          <Pill active={!isOpen}>{isOpen ? "Open" : "Fixed"}</Pill>
          <Pill>{t.severity || "minor"}</Pill>

          {/* Only show when flagged */}
          {flagged && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFlag?.(t); // typically toggles to false
              }}
              title="Flagged"
              className="rounded-lg px-2 py-1.5 border inline-flex items-center justify-center"
              style={{
                background: "#ef4444", // Tailwind red-500
                borderColor: "rgba(0,0,0,0.05)",
                color: "white",
              }}
            >
              <Flag className="h-4 w-4" />
            </button>
          )}

          {/* AI analyze */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAnalyze?.(t);
            }}
            title="AI Analyze"
            className="rounded-lg p-1.5 border hover:brightness-95 inline-flex items-center gap-1"
            style={{
              borderColor: analyzing ? T.magenta : T.stroke,
              background: analyzing ? "rgba(226,0,116,0.08)" : "white",
              color: analyzing ? T.magenta : "inherit",
            }}
            disabled={analyzing}
          >
            <Wand2 className="h-4 w-4" />
            <span className="sr-only">Analyze</span>
          </button>
        </div>
      </div>
    </motion.button>
  );
}

/* ---------- Chat bubble ---------- */
function Bubble({ role, author, text, ts }) {
  const isUser = role === "user";
  const isStaff = role === "staff";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 360, damping: 28 }}
      className={`max-w-[85%] sm:max-w-[70%] md:max-w-[60%] rounded-2xl p-3 sm:p-4 border shadow-sm ${
        isUser ? "mr-auto bg-white" : "ml-auto"
      }`}
      style={{
        background: isStaff
          ? T.magenta
          : isUser
          ? "rgba(255,255,255,0.95)"
          : "rgba(255,255,255,0.85)",
        color: isStaff ? "#fff" : T.ink,
        borderColor: isStaff ? "transparent" : T.stroke,
      }}
    >
      <div className="text-[11px] opacity-75 mb-1">
        <span className="font-semibold">
          {author || (isUser ? "Customer" : "Bot")}
        </span>{" "}
        ·{" "}
        {new Date(ts).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>
      <div className="text-sm whitespace-pre-wrap leading-relaxed">{text}</div>
    </motion.div>
  );
}

/* ---------- Page ---------- */
export default function Support() {
  const {
    tickets,
    filtered,
    selectedId,
    selectedTicket,
    currentMessages,
    openCount,
    fixedCount,
    filters,
    setFilters,
    selectTicket,
    sendMessage,
    closeTicket,
    loading,
    loadingThread,
    error,
    // optional: expose getMessages in the hook, but we’ll fetch here
  } = useSupportPanel({
    apiBase: "/api",
    socketOrigin: "", // set "http://localhost:4000" if needed
    staffName: "Agent",
  });

  const [input, setInput] = useState("");
  const [analyzingId, setAnalyzingId] = useState(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const listRef = useRef(null);

  const onSend = async () => {
    const text = input.trim();
    if (!text || !selectedId) return;
    const res = await sendMessage(selectedId, text);
    if (!res.ok) alert(res.error || "Send failed");
    setInput("");
  };

  const onClose = async () => {
    if (!selectedId) return;
    const ok = confirm("Close this ticket?");
    if (!ok) return;
    const r = await closeTicket(selectedId);
    if (!r.ok && r.status === 404) alert("Ticket not found");
    else if (!r.ok) alert("Close failed");
  };

  // auto-scroll thread bottom on new messages
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [currentMessages.length, loadingThread]);

  const statusTabs = useMemo(
    () => [
      { key: "all", label: `All (${tickets.length})` },
      { key: "open", label: `Open (${openCount})` },
      { key: "fixed", label: `Fixed (${fixedCount})` },
    ],
    [tickets.length, openCount, fixedCount]
  );

  /* ---------- AI Analyze (client-only heuristic) ---------- */
  const analyzeTicket = async (ticket) => {
    try {
      setAnalyzingId(ticket._id);
      // Fetch messages (server route exists from earlier backend)
      const res = await fetch(`/api/tickets/${ticket._id}/messages`);
      let msgs = [];
      if (res.ok) msgs = await res.json();

      // quick counts
      const userCount = msgs.filter((m) => m.authorType === "user").length;
      const staffCount = msgs.filter((m) => m.authorType === "staff").length;
      const botCount = msgs.filter((m) => m.authorType === "bot").length;
      const msgCount = msgs.length;

      // age & last activity
      const createdAt = ticket.createdAt ? new Date(ticket.createdAt) : null;
      const lastAt = ticket.lastMessageAt
        ? new Date(ticket.lastMessageAt)
        : null;
      const now = new Date();
      const ageMs = createdAt ? now - createdAt : 0;
      const lastMs = lastAt ? now - lastAt : 0;

      const toHuman = (ms) => {
        if (!ms) return "—";
        const m = Math.round(ms / 60000);
        if (m < 60) return `${m} min`;
        const h = Math.floor(m / 60);
        const rem = m % 60;
        return `${h}h ${rem}m`;
      };
      const ageHuman = toHuman(ageMs);
      const lastAtHuman = toHuman(lastMs);

      // simple “urgency” heuristic
      const severityScore =
        ticket.severity === "critical"
          ? 3
          : ticket.severity === "major"
          ? 2
          : 1;
      const lagScore =
        lastMs > 30 * 60 * 1000 ? 2 : lastMs > 10 * 60 * 1000 ? 1 : 0;
      const volumeScore = msgCount > 8 ? 2 : msgCount > 4 ? 1 : 0;
      const urgency = severityScore + lagScore + volumeScore; // 0-7 rough

      const signals = [];
      if (ticket.severity === "critical")
        signals.push("Critical severity — prioritize.");
      if (lagScore >= 2)
        signals.push("No agent activity in the last 30+ minutes.");
      if (userCount > staffCount)
        signals.push("More customer messages than staff responses.");
      if ((ticket.lastMessageSnippet || "").toLowerCase().includes("refund"))
        signals.push("Customer mentioned refund — consider credit/escalation.");
      if ((ticket.title || "").toLowerCase().includes("no signal"))
        signals.push("Likely network outage — check NOC/known incidents.");

      const nextAction =
        urgency >= 5
          ? "Escalate to Tier-2, acknowledge delay, and provide a concrete ETA."
          : urgency >= 3
          ? "Reply with next steps & expected resolution window; set follow-up reminder."
          : "Close loop with resolution or request missing details; offer survey link.";

      setAnalysis({
        title: ticket.title || "Untitled",
        severity: ticket.severity || "minor",
        status: ticket.status || "open",
        city: ticket.city,
        ageHuman,
        lastAtHuman,
        msgCount,
        userCount,
        staffCount,
        botCount,
        signals: signals.length ? signals : ["No risk signals detected."],
        nextAction,
      });
      setAnalysisOpen(true);
    } catch (e) {
      console.error(e);
      alert("Analyze failed");
    } finally {
      setAnalyzingId(null);
    }
  };

  /* ---------- Flag ticket (optimistic) ---------- */
  const flagTicket = async (ticket) => {
    const id = ticket._id;
    try {
      // optimistic UI: update local list if your hook exposes a setter;
      // otherwise just call the API.
      const res = await fetch(`/api/tickets/${id}/flag`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flagged: !ticket.flagged }),
      });
      if (!res.ok) {
        console.warn("Flag route missing or failed");
      }
      // Your hook likely receives socket "ticket:meta" updates and will refresh the row
    } catch (e) {
      console.error(e);
    }
  };

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
        <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8 py-3 flex items-center justify-between">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium"
            style={{ color: T.magenta }}
          >
            <ChevronLeft className="h-4 w-4" />
            Dashboard
          </a>
        </div>
      </header>

      {/* Body */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8 py-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sidebar: tickets */}
        <section
          className="rounded-2xl border p-3 lg:p-4"
          style={{
            background: T.surface,
            borderColor: T.stroke,
            boxShadow: "0 8px 26px rgba(226,0,116,0.15)",
          }}
        >
          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            {statusTabs.map((tab) => (
              <motion.button
                key={tab.key}
                onClick={() => setFilters((f) => ({ ...f, status: tab.key }))}
                whileTap={{ scale: 0.96 }}
                className="text-xs px-2.5 py-1 rounded-full border transition"
                style={{
                  background:
                    filters.status === tab.key
                      ? "rgba(226,0,116,0.12)"
                      : "rgba(255,255,255,0.85)",
                  color: filters.status === tab.key ? T.magenta : T.ink,
                  borderColor: T.stroke,
                }}
              >
                {tab.label}
              </motion.button>
            ))}
            <select
              value={filters.severity}
              onChange={(e) =>
                setFilters((f) => ({ ...f, severity: e.target.value }))
              }
              className="ml-auto text-xs border rounded-xl h-8 px-2 bg-white/80"
              style={{ borderColor: T.stroke }}
              title="Filter by severity"
            >
              <option value="all">All severities</option>
              <option value="minor">minor</option>
              <option value="major">major</option>
              <option value="critical">critical</option>
            </select>
          </div>

          {/* Search */}
          <div
            className="mt-3 flex items-center gap-2 border rounded-xl px-2 h-10 bg-white/85"
            style={{ borderColor: T.stroke }}
          >
            <Search className="h-4 w-4 text-slate-500" />
            <input
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              placeholder="Search title, city, snippet…"
              className="flex-1 bg-transparent outline-none text-sm"
            />
          </div>

          {/* List */}
          <div className="mt-3 max-h-[calc(100dvh-280px)] overflow-y-auto pr-1">
            {loading && (
              <div className="text-sm text-slate-600">Loading tickets…</div>
            )}
            {error && (
              <div className="text-sm text-rose-600">Error: {error}</div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="text-sm text-slate-600">
                No tickets match your filters.
              </div>
            )}

            <AnimatePresence initial={false}>
              {filtered.map((t) => (
                <motion.div
                  key={t._id}
                  layout
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ type: "spring", stiffness: 280, damping: 24 }}
                >
                  <TicketRow
                    t={t}
                    active={String(t._id) === String(selectedId)}
                    onClick={() => selectTicket(String(t._id))}
                    onAnalyze={analyzeTicket}
                    onFlag={flagTicket}
                    analyzing={analyzingId === t._id}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>

        {/* Main: conversation */}
        <section
          className="lg:col-span-2 rounded-2xl border p-3 sm:p-4 flex flex-col"
          style={{
            background: T.surface,
            borderColor: T.stroke,
            boxShadow: "0 8px 26px rgba(226,0,116,0.15)",
          }}
        >
          {/* Ticket header */}
          <div
            className="flex items-center justify-between gap-3 pb-2 border-b"
            style={{ borderColor: T.stroke }}
          >
            <div className="min-w-0">
              <div className="text-sm text-slate-600">Ticket</div>
              <motion.div
                key={selectedTicket?._id || "none"}
                layout
                className="font-semibold truncate"
              >
                {selectedTicket?.title ||
                  (selectedId ? "Loading…" : "Select a ticket")}
              </motion.div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {selectedTicket?.city && (
                  <span className="mr-3 inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {selectedTicket.city}
                  </span>
                )}
                {selectedTicket?.severity && (
                  <span>Severity: {selectedTicket.severity}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedTicket?.status !== "fixed" ? (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={onClose}
                  className="px-3 py-2 rounded-xl text-white text-sm"
                  style={{
                    background: T.magenta,
                    boxShadow: "0 6px 20px rgba(226,0,116,0.35)",
                  }}
                  title="Close ticket"
                >
                  <CheckCircle2 className="inline h-4 w-4 mr-1" /> Close
                </motion.button>
              ) : (
                <span className="text-emerald-600 text-sm inline-flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> Fixed
                </span>
              )}
            </div>
          </div>

          {/* Thread */}
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto py-3 space-y-3"
            style={{ scrollBehavior: "smooth" }}
          >
            {loadingThread && (
              <div className="text-sm text-slate-600">Loading history…</div>
            )}

            <AnimatePresence initial={false}>
              {currentMessages.map((m) => (
                <Bubble
                  key={m.id}
                  role={m.role}
                  author={m.author}
                  text={m.text}
                  ts={m.ts}
                />
              ))}
            </AnimatePresence>

            {!loadingThread && currentMessages.length === 0 && selectedId && (
              <div className="text-sm text-slate-600">
                No messages yet — say hello to the customer 👋
              </div>
            )}
            {!selectedId && (
              <div className="text-sm text-slate-600">
                Pick a ticket to view the conversation.
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="pt-2 border-t" style={{ borderColor: T.stroke }}>
            <div
              className="flex items-end gap-2 rounded-2xl border p-2 sm:p-3 bg:white/85"
              style={{
                borderColor: T.stroke,
                background: "rgba(255,255,255,0.85)",
              }}
            >
              <textarea
                rows={1}
                disabled={!selectedId}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSend();
                  }
                }}
                placeholder={
                  selectedId
                    ? "Type a reply… (Enter to send, Shift+Enter for newline)"
                    : "Select a ticket first"
                }
                className="flex-1 resize-none bg-transparent outline-none text-sm sm:text-base max-h-40 leading-6"
              />
              <motion.button
                whileTap={{ scale: 0.97 }}
                disabled={!selectedId || !input.trim()}
                onClick={onSend}
                className="inline-flex items-center gap-2 rounded-xl text-white px-4 py-2 font-medium transition disabled:opacity-50"
                style={{
                  background: T.magenta,
                  boxShadow: "0 8px 22px rgba(226,0,116,0.35)",
                }}
                title="Send"
              >
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">Send</span>
              </motion.button>
            </div>
            <div className="mt-2 text-[11px] sm:text-xs text-slate-500">
              Press{" "}
              <kbd className="px-1.5 py-0.5 rounded border border-slate-300 bg-white">
                Enter
              </kbd>{" "}
              to send,{" "}
              <kbd className="px-1.5 py-0.5 rounded border border-slate-300 bg-white">
                Shift
              </kbd>
              +
              <kbd className="px-1.5 py-0.5 rounded border border-slate-300 bg-white">
                Enter
              </kbd>{" "}
              for new line.
            </div>
          </div>
        </section>
      </main>

      {/* Analysis Modal */}
      <AnimatePresence>
        <AnalysisModal
          open={analysisOpen}
          onClose={() => setAnalysisOpen(false)}
          summary={analysis || {}}
        />
      </AnimatePresence>
    </div>
  );
}
