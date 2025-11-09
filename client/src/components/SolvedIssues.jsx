// src/components/SolvedIssues.jsx
import React from "react";
import useSolvedTickets from "../hooks/useSolvedTickets";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../components/ui/card";
import {
  MapPin,
  AlertTriangle,
  CheckCircle2,
  TimerReset,
  Sparkles,
} from "lucide-react";

const T = { magenta: "#E20074", stroke: "rgba(255,255,255,0.3)" };

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

const SentimentPill = ({ s = "neutral", score = 0 }) => {
  let bg = "#f8fafc",
    fg = "#334155";
  if (s === "happy") {
    bg = "#ecfdf5";
    fg = "#065f46";
  }
  if (s === "upset") {
    bg = "#fef2f2";
    fg = "#991b1b";
  }
  if (s === "confused") {
    bg = "#fff7ed";
    fg = "#9a3412";
  }
  return (
    <span
      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold border"
      style={{ background: bg, color: fg, borderColor: "rgba(0,0,0,0.08)" }}
      title={`score ${score >= 0 ? "+" : ""}${score}`}
    >
      <Sparkles className="h-3.5 w-3.5" />
      {s}{" "}
      <span className="opacity-70">
        ({score >= 0 ? "+" : ""}
        {score})
      </span>
    </span>
  );
};

const SevBadge = ({ sev = "minor" }) => {
  const tone =
    sev === "critical"
      ? { bg: "#fee2e2", fg: "#991b1b", Icon: AlertTriangle }
      : sev === "major"
      ? { bg: "#fef3c7", fg: "#92400e", Icon: AlertTriangle }
      : { bg: "#dcfce7", fg: "#166534", Icon: CheckCircle2 };
  const { Icon } = tone;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold"
      style={{ background: tone.bg, color: tone.fg }}
    >
      <Icon className="h-3.5 w-3.5" /> {sev}
    </span>
  );
};

const KeywordChip = ({ k }) => (
  <span
    className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border"
    style={{ background: "white", borderColor: "rgba(0,0,0,0.08)" }}
  >
    {k}
  </span>
);

export default function SolvedIssues({ limit = 12 }) {
  const { items, loading, reload } = useSolvedTickets({ limit });

  return (
    <Card
      className="rounded-2xl border backdrop-blur-xl"
      style={{
        background: "rgba(255,255,255,0.65)",
        borderColor: T.stroke,
        boxShadow: "0 8px 26px rgba(226,0,116,0.18)",
      }}
    >
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-slate-900">Last Solved Issues</CardTitle>
        <button
          onClick={reload}
          className="text-xs px-2 py-1 rounded-lg border"
          style={{
            borderColor: T.stroke,
            background: "rgba(255,255,255,0.85)",
            color: T.magenta,
          }}
        >
          <TimerReset className="h-3.5 w-3.5 inline mr-1" />
          Refresh
        </button>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && <div className="text-sm text-slate-600">Loading…</div>}
        {!loading && items.length === 0 && (
          <div className="text-sm text-slate-600">No solved tickets yet.</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((t) => (
            <div
              key={t._id}
              className="rounded-xl border p-3 bg-white"
              style={{ borderColor: "rgba(0,0,0,0.08)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div
                    className="font-semibold text-slate-900 truncate"
                    title={t.title}
                  >
                    {t.title}
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                    {t.city && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {t.city}
                      </span>
                    )}
                    <SevBadge sev={t.severity} />
                    {t.closedAt && (
                      <span title={new Date(t.closedAt).toLocaleString()}>
                        Closed {timeAgo(t.closedAt)}
                      </span>
                    )}
                  </div>
                </div>
                <SentimentPill s={t.aiSentiment} score={t.aiScore} />
              </div>

              {t.aiSummary && (
                <div className="text-sm text-slate-800 mt-2 whitespace-pre-wrap">
                  {t.aiSummary}
                </div>
              )}

              {t.aiKeywords?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {t.aiKeywords.slice(0, 12).map((k, i) => (
                    <KeywordChip key={i} k={k} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
