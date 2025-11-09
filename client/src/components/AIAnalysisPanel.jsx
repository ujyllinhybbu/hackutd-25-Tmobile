// components/AIAnalysisPanel.jsx
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wand2,
  X,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  MessageSquareText,
  Bot,
  UserRound,
  Clock,
  MapPin,
  Tag,
  Sparkles,
  ClipboardCopy,
  Check,
  Activity,
  Flag,
  Info,
  Gauge,
  Smile,
  Frown,
  HelpCircle,
} from "lucide-react";

const T = {
  magenta: "#E20074",
  magentaLight: "#FF77C8",
  surface: "rgba(255,255,255,0.94)",
  stroke: "rgba(15,23,42,0.12)",
  ink: "#0f172a",
};

const cn = (...xs) => xs.filter(Boolean).join(" ");

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

const sevTone = (sev = "minor") => {
  if (sev === "critical")
    return {
      chip: "bg-rose-100 text-rose-800",
      ring: "ring-rose-300",
      dot: "bg-rose-500",
    };
  if (sev === "major")
    return {
      chip: "bg-amber-100 text-amber-800",
      ring: "ring-amber-300",
      dot: "bg-amber-500",
    };
  return {
    chip: "bg-emerald-100 text-emerald-800",
    ring: "ring-emerald-300",
    dot: "bg-emerald-500",
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
  const tone = sevTone(sev);
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
      <Chip className={tone.chip}>
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

export default function AIAnalysisPanel({
  open,
  onClose,
  summary = {},
  onCopy,
}) {
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
            style={{ background: T.surface, borderColor: T.stroke }}
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
