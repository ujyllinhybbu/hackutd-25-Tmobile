import React, { useMemo, useRef, useState, useEffect } from "react";
import useSupportPanel from "../hooks/useSupportPanel";
import {
  Flag,
  Search,
  Send,
  CheckCircle2,
  Clock,
  MapPin,
  ChevronLeft,
  Wand2,
  X,
  MessageSquare,
  Loader2,
  Filter,
  AlertTriangle,
  Check,
  Activity,
  MessageSquareWarning,
  Info,
  // extra icons used by AI panel
  Smile,
  Frown,
  HelpCircle,
  Gauge,
  ClipboardCopy,
  Sparkles,
  Tag,
  Bot,
  MessageSquareText,
  UserRound,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/** --- Theme (T-Mobile inspired) --- */
const T = {
  magenta: "#E20074",
  magentaLight: "#FF77C8",
  surface: "rgba(255,255,255,0.70)",
  surface2: "rgba(255,255,255,0.88)",
  stroke: "rgba(255,255,255,0.35)",
  ink: "#0f172a",
};

/* ---------- utils ---------- */
const useNowTicker = (ms = 30_000) => {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
};

const timeAgo = (d) => {
  if (!d) return "—";
  const ms = Date.now() - new Date(d).getTime();
  if (ms < 60_000) return "just now";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return `${h}h ${r}m ago`;
};

const cn = (...xs) => xs.filter(Boolean).join(" ");

/* ---------- Color helpers ---------- */
const toneBySeverity = (sev = "minor") => {
  switch (sev) {
    case "critical":
      return {
        bg: "bg-rose-50",
        fg: "text-rose-700",
        ring: "ring-rose-300",
        dot: "bg-rose-500",
        chip: "bg-rose-100 text-rose-800",
      };
    case "major":
      return {
        bg: "bg-amber-50",
        fg: "text-amber-700",
        ring: "ring-amber-300",
        dot: "bg-amber-500",
        chip: "bg-amber-100 text-amber-800",
      };
    default:
      return {
        bg: "bg-emerald-50",
        fg: "text-emerald-700",
        ring: "ring-emerald-300",
        dot: "bg-emerald-500",
        chip: "bg-emerald-100 text-emerald-800",
      };
  }
};

const statusTone = (status = "open") =>
  status === "fixed"
    ? {
        bg: "bg-emerald-600",
        fg: "text-white",
        chip: "bg-emerald-100 text-emerald-800",
      }
    : {
        bg: "bg-slate-800",
        fg: "text-white",
        chip: "bg-slate-100 text-slate-800",
      };

/* ---------- Tiny UI bits ---------- */
function Dot({ className }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block h-2.5 w-2.5 rounded-full", className)}
    />
  );
}

function StatusBadge({ status }) {
  const t = statusTone(status);
  const Icon = status === "fixed" ? Check : Activity;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold",
        t.fg,
        t.bg
      )}
    >
      <Icon className="h-3.5 w-3.5" /> {status === "fixed" ? "Fixed" : "Open"}
    </span>
  );
}

function SeverityBadge({ severity = "minor" }) {
  const t = toneBySeverity(severity);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold",
        t.chip
      )}
    >
      <AlertTriangle className="h-3.5 w-3.5" /> {severity}
    </span>
  );
}

function CountChip({ icon: Icon, label }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-xl border text-[11px] px-2 py-1"
      style={{ borderColor: T.stroke, background: "rgba(255,255,255,0.85)" }}
    >
      <Icon className="h-3.5 w-3.5 opacity-70" />
      {label}
    </span>
  );
}

/* ========================================================================
   AI Analysis Panel (polished, icon-forward)
   ======================================================================== */

const sentimentMeta = (s = "neutral") => {
  const v = String(s).toLowerCase();
  if (v === "happy")
    return {
      label: "Happy",
      icon: Smile,
      bg: "bg-emerald-50",
      fg: "text-emerald-700",
      dot: "bg-emerald-500",
      bar: "bg-emerald-500",
      score: +5,
    };
  if (v === "upset")
    return {
      label: "Upset",
      icon: Frown,
      bg: "bg-rose-50",
      fg: "text-rose-700",
      dot: "bg-rose-500",
      bar: "bg-rose-500",
      score: -5,
    };
  if (v === "confused")
    return {
      label: "Confused",
      icon: HelpCircle,
      bg: "bg-amber-50",
      fg: "text-amber-700",
      dot: "bg-amber-500",
      bar: "bg-amber-500",
      score: -2,
    };
  return {
    label: "Neutral",
    icon: Gauge,
    bg: "bg-slate-50",
    fg: "text-slate-700",
    dot: "bg-slate-400",
    bar: "bg-slate-400",
    score: 0,
  };
};

function Chip({ children, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold",
        className
      )}
    >
      {children}
    </span>
  );
}

function BadgeRow({ summary }) {
  const st = String(summary?.status || "open");
  const sev = String(summary?.severity || "minor");
  const sevTone = toneBySeverity(sev);
  const isFixed = st === "fixed";
  return (
    <div className="flex flex-wrap gap-2">
      <Chip
        className={cn(
          "text-white",
          isFixed ? "bg-emerald-600" : "bg-slate-800"
        )}
      >
        {isFixed ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : (
          <Activity className="h-3.5 w-3.5" />
        )}
        {isFixed ? "Fixed" : "Open"}
      </Chip>
      <Chip className={sevTone.chip}>
        <AlertTriangle className="h-3.5 w-3.5" /> {sev}
      </Chip>
      {summary?.city && (
        <Chip className="bg-slate-100 text-slate-800">
          <MapPin className="h-3.5 w-3.5" /> {summary.city}
        </Chip>
      )}
      {summary?.flagged && (
        <Chip className="bg-rose-600 text-white">
          <Flag className="h-3.5 w-3.5" /> Flagged
        </Chip>
      )}
    </div>
  );
}

function SentimentMeter({ sentiment = "neutral", score = 0 }) {
  const m = sentimentMeta(sentiment);
  const pct = Math.max(0, Math.min(100, (score + 5) * 10)); // map -5..+5 → 0..100
  return (
    <div
      className={cn("rounded-xl p-3 border", m.bg)}
      style={{ borderColor: T.stroke }}
    >
      <div className="flex items-center justify-between gap-2">
        <div
          className={cn(
            "inline-flex items-center gap-1.5 text-sm font-semibold",
            m.fg
          )}
        >
          <m.icon className="h-4 w-4" />
          Sentiment: {m.label}
        </div>
        <div className="text-xs text-slate-500">
          Score {score >= 0 ? "+" : ""}
          {score}
        </div>
      </div>
      <div
        className="mt-2 h-2.5 rounded-full bg-white border"
        style={{ borderColor: T.stroke }}
      >
        <div
          className={cn("h-full rounded-full", m.bar)}
          style={{ width: `${pct}%`, transition: "width 300ms ease" }}
        />
      </div>
    </div>
  );
}

function KV({ label, value, icon: Icon }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="h-4 w-4 text-slate-500" />
      <span className="text-slate-500">{label}:</span>
      <span className="font-medium text-slate-800">{value ?? "—"}</span>
    </div>
  );
}

function KeywordChips({ items = [] }) {
  if (!items.length)
    return <div className="text-sm text-slate-500">No keywords extracted.</div>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((k, i) => (
        <span
          key={`${k}-${i}`}
          className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border bg-white"
          style={{ borderColor: T.stroke }}
          title={k}
        >
          <Tag className="h-3.5 w-3.5 text-slate-500" />
          {k}
        </span>
      ))}
    </div>
  );
}

function SignalsList({ items = [] }) {
  return (
    <ul className="list-none space-y-1.5">
      {items.length ? (
        items.map((s, i) => (
          <li key={i} className="text-sm flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 text-slate-500" />
            <span className="text-slate-800">{s}</span>
          </li>
        ))
      ) : (
        <li className="text-sm flex items-start gap-2 text-slate-600">
          <Sparkles className="h-4 w-4 mt-0.5" /> No risk signals detected.
        </li>
      )}
    </ul>
  );
}

function PeopleStats({ summary }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div
        className="rounded-xl p-3 border bg-white"
        style={{ borderColor: T.stroke }}
      >
        <div className="text-[11px] text-slate-500 mb-1">Messages</div>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-slate-500" />
          <b className="text-slate-800">{summary?.msgCount ?? 0}</b>
        </div>
      </div>
      <div
        className="rounded-xl p-3 border bg-white"
        style={{ borderColor: T.stroke }}
      >
        <div className="text-[11px] text-slate-500 mb-1">User</div>
        <div className="flex items-center gap-2">
          <UserRound className="h-4 w-4 text-slate-500" />
          <b className="text-slate-800">{summary?.userCount ?? 0}</b>
        </div>
      </div>
      <div
        className="rounded-xl p-3 border bg-white"
        style={{ borderColor: T.stroke }}
      >
        <div className="text-[11px] text-slate-500 mb-1">Staff/Bot</div>
        <div className="flex items-center gap-2">
          <MessageSquareText className="h-4 w-4 text-slate-500" />
          <b className="text-slate-800">
            {(summary?.staffCount ?? 0) + (summary?.botCount ?? 0)}
          </b>
        </div>
      </div>
    </div>
  );
}

function AIAnalysisPanel({ open, onClose, summary = {}, onCopy }) {
  const sMeta = sentimentMeta(summary.sentiment || "neutral");
  const score = Number(summary.aiScore ?? sMeta?.score ?? 0);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 p-3 sm:p-6 grid place-items-center">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          {/* Panel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="AI Analysis"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="relative w-full max-w-3xl rounded-2xl border shadow-2xl"
            style={{
              background: "rgba(255,255,255,0.94)",
              borderColor: T.stroke,
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between gap-2 p-3 sm:p-4 border-b"
              style={{ borderColor: T.stroke }}
            >
              <div
                className="flex items-center gap-2 text-sm font-semibold"
                style={{ color: T.magenta }}
              >
                <Wand2 className="h-4 w-4" />
                AI Analysis
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const text =
                      `Summary: ${summary.title || "Untitled"}\n` +
                      `Sentiment: ${
                        summary.sentiment || "neutral"
                      } (${score})\n` +
                      (summary.aiSummary ? `\n${summary.aiSummary}` : "");
                    navigator.clipboard.writeText(text).catch(() => {});
                    onCopy?.();
                  }}
                  className="rounded-lg p-1.5 border bg-white text-slate-700 hover:bg-slate-50"
                  style={{ borderColor: T.stroke }}
                  title="Copy summary"
                >
                  <ClipboardCopy className="h-4 w-4" />
                </button>
                <button
                  onClick={onClose}
                  className="rounded-lg p-1.5"
                  aria-label="Close"
                >
                  <X className="h-5 w-5 text-slate-700" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-3 sm:p-4 md:p-5 space-y-4">
              {/* Title + badges */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div
                    className="text-base sm:text-lg font-semibold text-slate-900 truncate"
                    title={summary.title}
                  >
                    {summary.title || "Untitled Ticket"}
                  </div>
                  <div className="mt-2">
                    <BadgeRow summary={summary} />
                  </div>
                </div>
              </div>

              {/* Sentiment + Meta */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <SentimentMeter sentiment={summary.sentiment} score={score} />
                </div>
                <div
                  className="rounded-xl p-3 border bg-white"
                  style={{ borderColor: T.stroke }}
                >
                  <div className="text-[11px] text-slate-500 mb-1">Meta</div>
                  <div className="space-y-1">
                    <KV label="Age" value={summary.ageHuman} icon={Clock} />
                    <KV
                      label="Last Activity"
                      value={summary.lastAtHuman}
                      icon={Activity}
                    />
                    {summary.city && (
                      <KV label="City" value={summary.city} icon={MapPin} />
                    )}
                  </div>
                </div>
              </div>

              {/* Conversation stats */}
              <PeopleStats summary={summary} />

              {/* Keywords + Signals */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div
                  className="rounded-xl p-3 border bg-white"
                  style={{ borderColor: T.stroke }}
                >
                  <div className="text-[11px] text-slate-500 mb-1 inline-flex items-center gap-1">
                    <Tag className="h-4 w-4" /> Keywords
                  </div>
                  <KeywordChips
                    items={summary.keywords || summary.aiKeywords || []}
                  />
                </div>
                <div
                  className="rounded-xl p-3 border bg-white"
                  style={{ borderColor: T.stroke }}
                >
                  <div className="text-[11px] text-slate-500 mb-1 inline-flex items-center gap-1">
                    <Info className="h-4 w-4" /> Signals
                  </div>
                  <SignalsList items={summary.signals || []} />
                </div>
              </div>

              {/* AI Summary (compact) */}
              {summary.aiSummary && (
                <div
                  className="rounded-xl p-3 border bg-white"
                  style={{ borderColor: T.stroke }}
                >
                  <div className="text-[11px] text-slate-500 mb-1 inline-flex items-center gap-1">
                    <Bot className="h-4 w-4" /> AI Summary
                  </div>
                  <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {summary.aiSummary}
                  </div>
                </div>
              )}

              {/* Next Action */}
              <div
                className="rounded-xl p-3 border"
                style={{
                  borderColor: T.stroke,
                  background: "rgba(226,0,116,0.06)",
                }}
              >
                <div className="text-[11px] text-slate-600 mb-1 inline-flex items-center gap-1">
                  <Check className="h-4 w-4" /> Suggested Next Action
                </div>
                <div className="text-sm text-slate-900">
                  {summary.nextAction || "No action required."}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div
              className="p-3 sm:p-4 border-t flex justify-end"
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
      )}
    </AnimatePresence>
  );
}

/* ========================================================================
   Ticket Row (icon-first, compact)
   ======================================================================== */

function TicketRow({ t, active, onClick, onAnalyze, onFlag, analyzing }) {
  const isOpen = t.status !== "fixed";
  const flagged = !!t.flagged;
  useNowTicker(30_000);

  const sevTone = toneBySeverity(t.severity);

  // conditions: lag, volume, refund keyword → show small icons
  const conditions = [];
  if (
    t.lastMessageAt &&
    Date.now() - new Date(t.lastMessageAt) > 30 * 60 * 1000
  ) {
    conditions.push({ icon: Clock, title: "30+ min since last activity" });
  }
  if ((t.messageCount ?? 0) > 10) {
    conditions.push({
      icon: MessageSquareWarning,
      title: "High message volume",
    });
  }
  if ((t.lastMessageSnippet || "").toLowerCase().includes("refund")) {
    conditions.push({ icon: Info, title: "Mentions refund" });
  }

  return (
    <motion.button
      onClick={onClick}
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className={cn(
        "w-full text-left relative rounded-2xl border p-3 mb-2.5 transition",
        "hover:brightness-[.99]"
      )}
      style={{
        background: "rgba(255,255,255,0.95)",
        borderColor: active ? T.magenta : T.stroke,
        boxShadow: active
          ? "0 0 0 4px rgba(226,0,116,0.12)"
          : "0 6px 18px rgba(226,0,116,0.08)",
      }}
      aria-pressed={active}
      role="option"
      aria-selected={!!active}
    >
      <div className="flex items-center gap-3">
        {/* left status disc */}
        <div
          className={cn(
            "grid place-items-center h-10 w-10 rounded-full ring-2",
            sevTone.ring
          )}
          style={{ background: "white" }}
        >
          <Dot className={cn("", sevTone.dot)} />
        </div>

        <div className="min-w-0 flex-1 pr-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="font-semibold text-slate-800 truncate"
              title={t.title || "Untitled"}
            >
              {t.title || "Untitled"}
            </div>
            <StatusBadge status={t.status} />
            <SeverityBadge severity={t.severity || "minor"} />
          </div>

          <div className="mt-0.5 text-[11px] text-slate-600 flex items-center gap-3">
            {t.city && (
              <span className="inline-flex items-center gap-1" title={t.city}>
                <MapPin className="h-3 w-3" /> {t.city}
              </span>
            )}
            {t.lastMessageAt && (
              <span
                className="inline-flex items-center gap-1"
                title={new Date(t.lastMessageAt).toLocaleString()}
              >
                <Clock className="h-3 w-3" />
                {timeAgo(t.lastMessageAt)}
              </span>
            )}
            {typeof t.messageCount === "number" && (
              <span className="inline-flex items-center gap-1">
                <MessageSquare className="h-3 w-3" /> {t.messageCount}
              </span>
            )}
            {/* conditions */}
            {conditions.map((c, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-amber-700"
                title={c.title}
              >
                <c.icon className="h-3 w-3" />
              </span>
            ))}
          </div>

          {t.lastMessageSnippet && (
            <div className="mt-1 text-[12px] text-slate-700 line-clamp-1">
              {t.lastMessageSnippet}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
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
            aria-busy={analyzing}
            disabled={analyzing}
          >
            {analyzing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            <span className="sr-only">Analyze</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onFlag?.(t);
            }}
            title={flagged ? "Unflag" : "Flag"}
            className={cn(
              "rounded-lg p-1.5 border inline-flex items-center justify-center",
              flagged ? "bg-rose-600 text-white border-transparent" : "bg-white"
            )}
            style={{ borderColor: flagged ? "transparent" : T.stroke }}
          >
            <Flag className="h-4 w-4" />
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
  useNowTicker(30_000);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 340, damping: 26 }}
      className={cn(
        "max-w-[85%] sm:max-w-[72%] md:max-w-[60%] rounded-2xl p-3 border shadow-sm",
        isUser ? "mr-auto bg-white" : "ml-auto"
      )}
      style={{
        background: isStaff
          ? T.magenta
          : isUser
          ? "rgba(255,255,255,0.95)"
          : "rgba(255,255,255,0.88)",
        color: isStaff ? "#fff" : T.ink,
        borderColor: isStaff ? "transparent" : T.stroke,
      }}
      title={new Date(ts).toLocaleString()}
      role="group"
    >
      <div className="text-[11px] opacity-70 mb-1 flex items-center gap-1">
        <span className="font-semibold truncate max-w-[55%]">
          {author || (isUser ? "Customer" : role === "bot" ? "Bot" : "Staff")}
        </span>
        <span className="opacity-60">·</span>
        <span className="truncate">{timeAgo(ts)}</span>
      </div>
      <div className="text-[13px] sm:text-sm whitespace-pre-wrap leading-relaxed">
        {text}
      </div>
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
  } = useSupportPanel({
    apiBase: "/api",
    socketOrigin: "",
    staffName: "Agent",
  });

  const [input, setInput] = useState("");
  const [analyzingId, setAnalyzingId] = useState(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const listRef = useRef(null);
  const atBottomRef = useRef(true);

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

  // smart autoscroll
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
      atBottomRef.current = nearBottom;
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (atBottomRef.current)
      requestAnimationFrame(() => (el.scrollTop = el.scrollHeight));
  }, [currentMessages.length, loadingThread]);

  const statusTabs = useMemo(
    () => [
      { key: "all", label: `All (${tickets.length})`, icon: Activity },
      { key: "open", label: `Open (${openCount})`, icon: MessageSquare },
      { key: "fixed", label: `Fixed (${fixedCount})`, icon: CheckCircle2 },
    ],
    [tickets.length, openCount, fixedCount]
  );

  // ---- lightweight client analysis (uses your existing /messages route)
  const analyzeTicket = async (ticket) => {
    try {
      setAnalyzingId(ticket._id);
      const res = await fetch(`/api/tickets/${ticket._id}/messages`);
      let msgs = [];
      if (res.ok) msgs = await res.json();

      const userCount = msgs.filter((m) => m.authorType === "user").length;
      const staffCount = msgs.filter((m) => m.authorType === "staff").length;
      const botCount = msgs.filter((m) => m.authorType === "bot").length;
      const msgCount = msgs.length;

      const createdAt = ticket.createdAt ? new Date(ticket.createdAt) : null;
      const lastAt = ticket.lastMessageAt
        ? new Date(ticket.lastMessageAt)
        : null;
      const now = new Date();
      const toHuman = (ms) => {
        if (!ms && ms !== 0) return "—";
        const m = Math.round(ms / 60000);
        if (m < 60) return `${m} min`;
        const h = Math.floor(m / 60);
        const rem = m % 60;
        return `${h}h ${rem}m`;
      };
      const ageHuman = createdAt
        ? toHuman(now.getTime() - createdAt.getTime())
        : "—";
      const lastAtHuman = lastAt
        ? toHuman(now.getTime() - lastAt.getTime())
        : "—";

      const severityScore =
        ticket.severity === "critical"
          ? 3
          : ticket.severity === "major"
          ? 2
          : 1;
      const lagScore =
        lastAt && now.getTime() - lastAt.getTime() > 30 * 60 * 1000
          ? 2
          : lastAt && now.getTime() - lastAt.getTime() > 10 * 60 * 1000
          ? 1
          : 0;
      const volumeScore = msgCount > 8 ? 2 : msgCount > 4 ? 1 : 0;
      const urgency = severityScore + lagScore + volumeScore;

      const signals = [];
      if (ticket.severity === "critical")
        signals.push("Critical severity — prioritize.");
      if (lagScore >= 2)
        signals.push("No agent activity in the last 30+ minutes.");
      if (userCount > staffCount)
        signals.push("More customer messages than staff responses.");
      if ((ticket.lastMessageSnippet || "").toLowerCase().includes("refund"))
        signals.push("Customer mentioned refund — consider credit/escalation.");

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
        // pull AI fields if your server saved them
        sentiment: ticket.aiSentiment || ticket.sentiment || "neutral",
        aiKeywords: ticket.aiKeywords || ticket.keywords || [],
        aiSummary: ticket.aiSummary || "",
        flagged: !!ticket.flagged,
        aiScore:
          (ticket.aiSentiment === "happy" && 5) ||
          (ticket.aiSentiment === "upset" && -5) ||
          (ticket.aiSentiment === "confused" && -2) ||
          0,
      });
      setAnalysisOpen(true);
    } catch (e) {
      console.error(e);
      alert("Analyze failed");
    } finally {
      setAnalyzingId(null);
    }
  };

  const flagTicket = async (ticket) => {
    const id = ticket._id;
    try {
      const res = await fetch(`/api/tickets/${id}/flag`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flagged: !ticket.flagged }),
      });
      if (!res.ok) console.warn("Flag route missing or failed");
    } catch (e) {
      console.error(e);
    }
  };

  const headerChips = (
    <div className="hidden sm:flex items-center gap-2">
      <CountChip
        icon={MessageSquare}
        label={`${selectedTicket?.messageCount ?? 0} msgs`}
      />
      {selectedTicket?.severity && (
        <CountChip icon={Flag} label={selectedTicket.severity} />
      )}
      {selectedTicket?.city && (
        <CountChip icon={MapPin} label={selectedTicket.city} />
      )}
    </div>
  );

  return (
    <div
      className="h-dvh flex flex-col overflow-hidden"
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
        <div className="mx-auto max-w-7xl px-3 sm:px-6 md:px-8 py-2.5 flex items-center justify-between gap-2">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium"
            style={{ color: T.magenta }}
          >
            <ChevronLeft className="h-4 w-4" /> Dashboard
          </a>
          <button
            onClick={() => setShowFilters((s) => !s)}
            className="sm:hidden inline-flex items-center gap-1 text-xs px-2 py-1 rounded-xl border"
            style={{
              borderColor: T.stroke,
              background: "rgba(255,255,255,0.9)",
            }}
            aria-expanded={showFilters}
            aria-controls="filters"
          >
            <Filter className="h-3.5 w-3.5" /> Filters
          </button>
          {headerChips}
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 min-h-0 overflow-hidden mx-auto max-w-7xl px-3 sm:px-6 md:px-8 py-4 grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Sidebar */}
        <section
          className="rounded-2xl border p-3 sm:p-4 flex flex-col min-h-0"
          style={{
            background: T.surface,
            borderColor: T.stroke,
            boxShadow: "0 8px 26px rgba(226,0,116,0.15)",
          }}
        >
          <div
            id="filters"
            className={cn(
              "sm:block",
              showFilters ? "block" : "hidden sm:block"
            )}
          >
            <TicketFilters
              tickets={tickets}
              openCount={openCount}
              fixedCount={fixedCount}
              filters={filters}
              setFilters={setFilters}
              statusTabs={statusTabs}
            />
          </div>

          <div className="mt-3 flex-1 min-h-0 overflow-y-auto pr-1">
            {loading && <ListSkeleton />}
            {error && (
              <div className="text-sm text-rose-600">Error: {error}</div>
            )}
            {!loading && filtered.length === 0 && <EmptyState />}

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

        {/* Conversation */}
        <section
          className="lg:col-span-2 rounded-2xl border p-3 sm:p-4 flex flex-col min-h-0"
          style={{
            background: T.surface,
            borderColor: T.stroke,
            boxShadow: "0 8px 26px rgba(226,0,116,0.15)",
          }}
        >
          {/* Thread Header */}
          <div
            className="flex items-center justify-between gap-3 pb-2 border-b"
            style={{ borderColor: T.stroke }}
          >
            <div className="min-w-0">
              <div className="text-[11px] text-slate-600">Ticket</div>
              <motion.div
                key={selectedTicket?._id || "none"}
                layout
                className="font-semibold truncate"
              >
                {selectedTicket?.title ||
                  (selectedId ? "Loading…" : "Select a ticket")}
              </motion.div>
              <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                {selectedTicket?.city && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {selectedTicket.city}
                  </span>
                )}
                {selectedTicket?.severity && (
                  <span>Severity: {selectedTicket.severity}</span>
                )}
                {typeof selectedTicket?.messageCount === "number" && (
                  <span> · {selectedTicket.messageCount} messages</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
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
              {selectedTicket && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => analyzeTicket(selectedTicket)}
                  className="px-2.5 py-2 rounded-xl text-sm border inline-flex items-center gap-1"
                  style={{
                    borderColor: T.stroke,
                    background: "rgba(255,255,255,0.95)",
                  }}
                  title="Analyze conversation"
                >
                  <Wand2 className="h-4 w-4" />{" "}
                  <span className="hidden sm:inline">Analyze</span>
                </motion.button>
              )}
            </div>
          </div>

          {/* Thread (self-scrolling) */}
          <div
            ref={listRef}
            className="flex-1 min-h-0 overflow-y-auto py-3 space-y-2.5"
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
          <Composer
            disabled={!selectedId}
            input={input}
            setInput={setInput}
            onSend={onSend}
          />
        </section>
      </main>

      {/* Analysis Modal */}
      <AIAnalysisPanel
        open={analysisOpen}
        onClose={() => setAnalysisOpen(false)}
        summary={analysis || {}}
      />
    </div>
  );
}

/* ---------- subcomponents ---------- */
function TicketFilters({
  tickets,
  openCount,
  fixedCount,
  filters,
  setFilters,
  statusTabs,
}) {
  return (
    <>
      <div className="flex flex-wrap gap-1.5 items-center">
        {statusTabs.map((tab) => (
          <motion.button
            key={tab.key}
            onClick={() => setFilters((f) => ({ ...f, status: tab.key }))}
            whileTap={{ scale: 0.96 }}
            className="text-[11px] px-2.5 py-1 rounded-full border transition inline-flex items-center gap-1"
            style={{
              background:
                filters.status === tab.key
                  ? "rgba(226,0,116,0.12)"
                  : "rgba(255,255,255,0.85)",
              color: filters.status === tab.key ? T.magenta : T.ink,
              borderColor: T.stroke,
            }}
          >
            <tab.icon className="h-3.5 w-3.5" /> {tab.label}
          </motion.button>
        ))}

        <select
          value={filters.severity}
          onChange={(e) =>
            setFilters((f) => ({ ...f, severity: e.target.value }))
          }
          className="ml-auto text-[11px] border rounded-xl h-8 px-2 bg-white/80"
          style={{ borderColor: T.stroke }}
          title="Filter by severity or flagged"
        >
          <option value="all">All tickets</option>
          <option value="minor">Minor</option>
          <option value="major">Major</option>
          <option value="critical">Critical</option>
          <option value="flagged">Flagged</option>
        </select>
      </div>

      <div
        className="mt-2 flex items-center gap-2 border rounded-xl px-2 h-9 bg-white/85"
        style={{ borderColor: T.stroke }}
      >
        <Search className="h-4 w-4 text-slate-500" />
        <input
          value={filters.q}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          placeholder="Search title, city, snippet…"
          className="flex-1 bg-transparent outline-none text-[13px]"
          aria-label="Search tickets"
        />
      </div>
    </>
  );
}

function Composer({ disabled, input, setInput, onSend }) {
  const [rows, setRows] = useState(1);
  useEffect(() => {
    const lines = input.split("\n").length;
    setRows(Math.min(6, Math.max(1, lines)));
  }, [input]);

  return (
    <>
      <div className="pt-2 border-top" style={{ borderColor: T.stroke }} />
      <div className="pt-2 border-t" style={{ borderColor: T.stroke }}>
        <div
          className="flex items-end gap-2 rounded-2xl border p-2 sm:p-3 bg:white/85"
          style={{ borderColor: T.stroke, background: "rgba(255,255,255,0.9)" }}
        >
          <textarea
            rows={rows}
            disabled={disabled}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (
                (e.key === "Enter" && !e.shiftKey) ||
                (e.key === "Enter" && (e.metaKey || e.ctrlKey))
              ) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder={!disabled ? "Type a reply…" : "Select a ticket first"}
            className="flex-1 resize-none bg-transparent outline-none text-sm sm:text-[15px] max-h-40 leading-6"
            aria-label="Message composer"
          />
          <motion.button
            whileTap={{ scale: 0.97 }}
            disabled={disabled || !input.trim()}
            onClick={onSend}
            className="inline-flex items-center gap-2 rounded-xl text-white px-3 sm:px-4 py-2 font-medium transition disabled:opacity-50"
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
        <div className="mt-1.5 text-[11px] sm:text-xs text-slate-500 flex items-center justify-between">
          <div>
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
          <div className="opacity-70">{input.trim().length} chars</div>
        </div>
      </div>
    </>
  );
}

/* ---------- Empty / Skeleton ---------- */
function EmptyState() {
  return (
    <div className="text-sm text-slate-600 grid place-items-center py-10">
      <div className="text-center max-w-xs">
        <div className="mx-auto grid place-items-center h-12 w-12 rounded-full bg-slate-100 mb-3">
          <Search className="h-5 w-5 text-slate-500" />
        </div>
        <div className="font-semibold">No tickets match your filters</div>
        <div className="text-slate-500 mt-1">
          Try changing status, severity, or the search query.
        </div>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-[74px] rounded-2xl border overflow-hidden"
          style={{ borderColor: T.stroke, background: "rgba(255,255,255,0.9)" }}
        >
          <div className="animate-pulse h-full">
            <div className="h-5 w-2/3 bg-slate-200/70 mt-3 ml-3 rounded"></div>
            <div className="h-3 w-1/3 bg-slate-200/60 mt-2 ml-3 rounded"></div>
            <div className="h-3 w-5/6 bg-slate-200/50 mt-3 ml-3 rounded"></div>
          </div>
        </div>
      ))}
    </div>
  );
}
