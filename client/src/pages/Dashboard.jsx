import React, { useState, useMemo } from "react";
import useLiveTickets from "../hooks/useLiveTickets";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import {
  Activity,
  AlertTriangle,
  Smile,
  Frown,
  Signal,
  RefreshCw,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from "recharts";

/** --- THEME (T-Mobile) --- */
const TMOBILE = {
  magenta: "#E20074",
  magentaLight: "#FF77C8",
  magentaSoft: "#FF9AD5",
  ink: "#0B0B0C",
  slate900: "#0f172a",
  surface: "rgba(255,255,255,0.65)",
  stroke: "rgba(255,255,255,0.3)",
  grid: "rgba(0,0,0,0.08)",
  glow: "0 8px 28px rgba(226, 0, 116, 0.25)",
};

/** --- UTIL --- */
function formatClock(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function KPI({ label, value, sub, icon }) {
  return (
    <Card
      className="group flex flex-col justify-between rounded-2xl border backdrop-blur-xl transition-all
                 hover:-translate-y-0.5"
      style={{
        background: TMOBILE.surface,
        borderColor: TMOBILE.stroke,
        boxShadow: TMOBILE.glow,
      }}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-800/90">
          {label}
        </CardTitle>
        <div className="opacity-80 group-hover:opacity-100 transition-opacity">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div
          className="text-3xl sm:text-4xl font-extrabold tracking-tight"
          style={{ color: TMOBILE.magenta }}
          aria-live="polite"
        >
          {value}
        </div>
        {sub && <div className="text-xs text-slate-700/80 mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

/** --- CHARTS --- */
function TrendChart({ data }) {
  const formatted = (data || []).map((d) => ({
    time: formatClock(d.ts),
    Confirmed: d.confirmed,
    Projected: d.projected ?? d.confirmed,
  }));
  return (
    <Card
      className="rounded-2xl border backdrop-blur-xl transition-all"
      style={{
        background: TMOBILE.surface,
        borderColor: TMOBILE.stroke,
        boxShadow: TMOBILE.glow,
      }}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-slate-900">
          Happiness Index — Real-time Trend
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] sm:h-[350px] md:h-[400px] w-full">
          <ResponsiveContainer>
            <LineChart data={formatted}>
              <CartesianGrid strokeDasharray="3 3" stroke={TMOBILE.grid} />
              <XAxis dataKey="time" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ borderRadius: 12, borderColor: TMOBILE.stroke }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="Confirmed"
                dot={false}
                strokeWidth={3}
                stroke={TMOBILE.magenta}
              />
              <Line
                type="monotone"
                dataKey="Projected"
                dot={false}
                strokeWidth={3}
                stroke={TMOBILE.magentaSoft}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function SeverityBar({ counts }) {
  const data = Object.entries(counts || {}).map(([k, v]) => ({
    bucket: k,
    count: v,
  }));
  return (
    <Card
      className="rounded-2xl border backdrop-blur-xl transition-all"
      style={{
        background: TMOBILE.surface,
        borderColor: TMOBILE.stroke,
        boxShadow: TMOBILE.glow,
      }}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-slate-900">
          Tickets by Severity (recent)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] sm:h-[350px] md:h-[400px] w-full">
          <ResponsiveContainer>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={TMOBILE.grid} />
              <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ borderRadius: 12, borderColor: TMOBILE.stroke }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Bar
                dataKey="count"
                fill={TMOBILE.magenta}
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function Alerts({
  series,
  minutes = 10,
  lateWindowPct = 0.4,
  absDrop = 12,
  pctDrop = 12,
}) {
  if (!series || series.length < 3) return null;

  // Keep only last N minutes
  const now = Date.now();
  const cutoff = now - minutes * 60 * 1000;
  const recent = series.filter((p) => p.ts >= cutoff);
  if (recent.length < 3) return null;

  // Split into early vs late slices (e.g., last 40% is "late")
  const splitIdx = Math.max(1, Math.floor(recent.length * (1 - lateWindowPct)));
  const early = recent.slice(0, splitIdx);
  const late = recent.slice(splitIdx);

  const avg = (arr) =>
    arr.reduce((s, x) => s + Number(x.confirmed ?? 0), 0) /
    Math.max(1, arr.length);

  const earlyAvg = avg(early);
  const lateAvg = avg(late);
  const dropAbs = Math.round(earlyAvg - lateAvg);
  const dropPct =
    earlyAvg > 0 ? Math.round(((earlyAvg - lateAvg) / earlyAvg) * 100) : 0;

  const showAlert = dropAbs >= absDrop || dropPct >= pctDrop;

  return (
    <Card
      className="rounded-2xl border backdrop-blur-xl"
      style={{
        background: "rgba(255,255,255,0.65)",
        borderColor: "rgba(255,255,255,0.3)",
        boxShadow: "0 8px 28px rgba(226,0,116,0.25)",
      }}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-slate-900">Early Warning</CardTitle>
      </CardHeader>
      <CardContent>
        {showAlert ? (
          <Alert
            className="rounded-xl border"
            style={{
              background: "rgba(226,0,116,0.18)",
              color: "#E20074",
              borderColor: "rgba(226,0,116,0.4)",
            }}
          >
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Sentiment Drop Detected</AlertTitle>
            <AlertDescription>
              {`Avg HI fell by ${dropAbs} pts (${dropPct}%)
               over the last ${minutes} min. Investigate common topics.`}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert
            className="rounded-xl border"
            style={{
              background: "rgba(255,255,255,0.6)",
              borderColor: "rgba(255,255,255,0.3)",
              color: "#0f172a",
            }}
          >
            <Smile className="h-4 w-4" />
            <AlertTitle>Stable</AlertTitle>
            <AlertDescription>
              No significant negative trend detected in the last {minutes}{" "}
              minutes.
            </AlertDescription>
          </Alert>
        )}

        {/* Tiny diagnostic line; keep or remove */}
        <div className="mt-2 text-xs text-slate-600">
          Early avg: {Math.round(earlyAvg)} · Late avg: {Math.round(lateAvg)} ·
          Δ {dropAbs} ({dropPct}%)
        </div>
      </CardContent>
    </Card>
  );
}

/** Ops (Avg Active & Avg Resolution) */
function OpsCharts({ data }) {
  const formatted = (data || []).map((d) => ({
    time: formatClock(d.ts),
    "Avg Active (min)": d.activeMin,
    "Avg Resolution (min)": d.resolutionMin,
  }));

  return (
    <Card
      className="rounded-2xl border backdrop-blur-xl transition-all"
      style={{
        background: TMOBILE.surface,
        borderColor: TMOBILE.stroke,
        boxShadow: TMOBILE.glow,
      }}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-slate-900">
          Operations — Avg Active & Resolution Time
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] sm:h-[350px] md:h-[400px] w-full">
          <ResponsiveContainer>
            <LineChart data={formatted}>
              <CartesianGrid strokeDasharray="3 3" stroke={TMOBILE.grid} />
              <XAxis dataKey="time" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ borderRadius: 12, borderColor: TMOBILE.stroke }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="Avg Active (min)"
                dot={false}
                strokeWidth={3}
                stroke="#6366F1"
              />
              <Line
                type="monotone"
                dataKey="Avg Resolution (min)"
                dot={false}
                strokeWidth={3}
                stroke="#10B981"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

/** Business Insights */
function BusinessInsights({
  todayCount,
  projectedToday,
  avg7d,
  avg30d,
  deltaVs7d,
  hourlyToday,
}) {
  const deltaColor =
    deltaVs7d == null
      ? "text-slate-600"
      : deltaVs7d >= 0
      ? "text-emerald-600"
      : "text-rose-600";

  return (
    <Card
      className="rounded-2xl border backdrop-blur-xl transition-all"
      style={{
        background: TMOBILE.surface,
        borderColor: TMOBILE.stroke,
        boxShadow: TMOBILE.glow,
      }}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-slate-900">Business Insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-5 gap-4">
          <KPI label="Today's Tickets" value={todayCount} sub="Since 00:00" />
          <KPI
            label="Projected Today"
            value={projectedToday}
            sub="Rate-based projection"
          />
          <KPI label="7-Day Avg" value={avg7d ?? "—"} sub="Per day" />
          <KPI label="30-Day Avg" value={avg30d ?? "—"} sub="Per day" />
          <KPI
            label="vs 7-Day Avg"
            value={
              deltaVs7d == null
                ? "—"
                : `${deltaVs7d > 0 ? "+" : ""}${deltaVs7d}%`
            }
            sub="Positive = busier"
            icon={<Signal />}
          />
        </div>

        <div className="h-[220px] w-full">
          <ResponsiveContainer>
            <BarChart data={hourlyToday || []}>
              <CartesianGrid strokeDasharray="3 3" stroke={TMOBILE.grid} />
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={2} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ borderRadius: 12, borderColor: TMOBILE.stroke }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Bar
                dataKey="count"
                fill={TMOBILE.magenta}
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={`text-xs ${deltaColor}`}>
          {deltaVs7d == null
            ? "Historical averages unavailable — add /api/metrics to your backend for 7d/30d."
            : deltaVs7d === 0
            ? "On pace with your 7-day average."
            : deltaVs7d > 0
            ? "Busier than usual versus the 7-day average."
            : "Quieter than usual versus the 7-day average."}
        </div>
      </CardContent>
    </Card>
  );
}

/** --- PAGE --- */
export default function DashboardDemo() {
  const {
    stats,
    series,
    severityCounts,
    actions,
    log,
    metrics,
    todayCount,
    projectedToday,
    deltaVs7d,
    hourlyToday,
    opsSeries,
  } = useLiveTickets();

  const latestConfirmed = (series || []).at(-1)?.confirmed ?? 70;
  const latestProjected = (series || []).at(-1)?.projected ?? latestConfirmed;

  const [title, setTitle] = useState("No signal near downtown");
  const [city, setCity] = useState("Dallas");
  const [severity, setSeverity] = useState("critical");
  const [closeId, setCloseId] = useState("");

  return (
    <div
      className="min-h-screen flex flex-col w-full overflow-x-hidden"
      style={{
        background:
          "radial-gradient(1200px 700px at -10% -10%, rgba(226,0,116,0.08), transparent 50%), radial-gradient(1200px 700px at 110% 10%, rgba(255,119,200,0.08), transparent 50%), linear-gradient(to bottom right, #ffffff, #f8fafc)",
      }}
    >
      {/* Top Bar */}
      <div
        className="w-full border-b backdrop-blur-xl"
        style={{
          background: "rgba(255,255,255,0.7)",
          borderColor: TMOBILE.stroke,
        }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-10 py-4 flex items-center justify-between">
          <div>
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
              Live
            </div>
            <h1
              className="mt-2 text-2xl md:text-3xl font-extrabold tracking-tight"
              style={{
                backgroundImage: `linear-gradient(90deg, ${TMOBILE.magenta}, ${TMOBILE.magentaLight})`,
                WebkitBackgroundClip: "text",
                color: "transparent",
              }}
            >
              T-Mobile AI Dashboard
            </h1>
            <p className="text-slate-700/80 text-sm md:text-base">
              Real-time sentiment & operations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              className="rounded-xl text-white transition-all hover:-translate-y-0.5"
              style={{
                background: TMOBILE.magenta,
                boxShadow: "0 6px 20px rgba(226,0,116,0.35)",
              }}
              onClick={async () => {
                const res = await actions.createTicket({
                  title,
                  city,
                  severity,
                });
                if (!res || res.success !== true) alert("Create failed");
                if (res?.ticket?._id) setCloseId(res.ticket._id);
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" /> Create Ticket
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 md:px-10 py-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPI
            label="Happiness Index"
            value={`${Math.round(latestConfirmed)}`}
            sub="Confirmed"
            icon={<Activity />}
          />
          <KPI
            label="Projected HI"
            value={`${Math.round(latestProjected)}`}
            sub="After last agent"
            icon={<Signal />}
          />
          <KPI
            label="Open Tickets"
            value={`${stats?.open ?? 0}`}
            sub="Current open"
            icon={<Frown />}
          />
          <KPI
            label="Fixed Tickets"
            value={`${stats?.fixed ?? 0}`}
            sub="Resolved"
            icon={<Smile />}
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2">
            <TrendChart data={series} />
          </div>
          <SeverityBar counts={severityCounts} />
        </div>

        {/* Ops */}
        <OpsCharts data={opsSeries} />

        {/* Business Insights */}
        <BusinessInsights
          todayCount={todayCount}
          projectedToday={projectedToday}
          avg7d={metrics.avg7d}
          avg30d={metrics.avg30d}
          deltaVs7d={deltaVs7d}
          hourlyToday={hourlyToday}
        />

        {/* Actions */}
        <Card
          className="rounded-2xl border backdrop-blur-xl"
          style={{
            background: TMOBILE.surface,
            borderColor: TMOBILE.stroke,
            boxShadow: TMOBILE.glow,
          }}
        >
          <CardHeader>
            <CardTitle className="text-slate-900">Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <input
                aria-label="Ticket title"
                className="border rounded-xl h-10 px-3 bg-white/80 focus:outline-none focus:ring-2 transition"
                style={{
                  borderColor: TMOBILE.stroke,
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3)",
                }}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="title"
              />
              <input
                aria-label="City"
                className="border rounded-xl h-10 px-3 bg-white/80 focus:outline-none focus:ring-2 transition"
                style={{
                  borderColor: TMOBILE.stroke,
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3)",
                }}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="city"
              />
              <select
                aria-label="Severity"
                className="border rounded-xl h-10 px-3 bg-white/80 focus:outline-none focus:ring-2 transition"
                style={{ borderColor: TMOBILE.stroke }}
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
              >
                <option value="minor">minor</option>
                <option value="major">major</option>
                <option value="critical">critical</option>
              </select>
              <Button
                className="rounded-xl text-white transition-all hover:-translate-y-0.5"
                style={{
                  background: TMOBILE.magenta,
                  boxShadow: "0 6px 20px rgba(226,0,116,0.35)",
                }}
                onClick={async () => {
                  const res = await actions.createTicket({
                    title,
                    city,
                    severity,
                  });
                  if (!res || res.success !== true) alert("Create failed");
                  if (res?.ticket?._id) setCloseId(res.ticket._id);
                }}
              >
                Create Ticket
              </Button>
            </div>
            <div className="flex gap-2">
              <input
                aria-label="Ticket id to close"
                className="border rounded-xl h-10 px-3 flex-1 bg-white/80 focus:outline-none focus:ring-2 transition"
                style={{ borderColor: TMOBILE.stroke }}
                value={closeId}
                onChange={(e) => setCloseId(e.target.value)}
                placeholder="ticket _id to close"
              />
              <Button
                variant="outline"
                className="rounded-xl transition-all hover:-translate-y-0.5"
                style={{
                  background: "white",
                  borderColor: TMOBILE.magenta,
                  color: TMOBILE.magenta,
                  boxShadow: "0 4px 16px rgba(226,0,116,0.15)",
                }}
                onClick={async () => {
                  const id = closeId.trim();
                  if (!id) return alert("Paste a ticket _id");
                  const res = await actions.closeTicket(id);
                  if (res.status === 409) alert("Already fixed");
                  else if (res.status === 404) {
                    const reason = res.data?.reason || "not found";
                    alert(`Not found (${reason}). Check route & DB.`);
                  } else if (!(res.status >= 200 && res.status < 300)) {
                    alert("Close failed");
                  }
                }}
              >
                Close Ticket
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Alerts + Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Alerts series={series} />
          <Card
            className="lg:col-span-2 rounded-2xl border backdrop-blur-xl"
            style={{
              background: TMOBILE.surface,
              borderColor: TMOBILE.stroke,
              boxShadow: TMOBILE.glow,
            }}
          >
            <CardHeader>
              <CardTitle className="text-slate-900">📋 Live Feed</CardTitle>
            </CardHeader>
            <CardContent>
              <pre
                className="h-64 overflow-y-auto p-3 rounded-lg text-sm"
                style={{
                  background: "rgba(255,255,255,0.55)",
                  border: `1px solid ${TMOBILE.stroke}`,
                  lineHeight: 1.35,
                }}
                aria-live="polite"
              >
                {(log || []).map(
                  (l) => `[${new Date(l.ts).toLocaleTimeString()}] ${l.text}\n`
                )}
              </pre>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 text-center text-xs text-slate-600">
        <span>
          Made with <span style={{ color: TMOBILE.magenta }}>♥</span> — T-Mobile
          Magenta UI
        </span>
      </footer>
    </div>
  );
}
