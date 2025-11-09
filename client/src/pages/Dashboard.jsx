import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Activity, AlertTriangle, Smile, Frown, PhoneCall, Signal, MapPin, RefreshCw } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";

// -----------------------------
// Mock data + utilities
// -----------------------------





const REGIONS = [
  "Dallas North",
  "Dallas South",
  "Austin",
  "Houston",
  "Chicago",
];

const TOPICS = ["billing", "network", "device", "account", "care"];
const TOPIC_LABEL = {
  billing: "Billing",
  network: "Network",
  device: "Device",
  account: "Account",
  care: "Customer Service",
};

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp01(x) {
  return Math.max(0, Math.min(100, x));
}

function formatClock(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// generate a customer utterance with topic + sentiment
function genCustomerTurn(prevHI) {
  const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
  const region = REGIONS[Math.floor(Math.random() * REGIONS.length)];
  // sentiment baseline by topic
  const baseByTopic = {
    billing: [30, 60],
    network: [25, 55],
    device: [40, 70],
    account: [45, 80],
    care: [35, 65],
  };
  const [lo, hi] = baseByTopic[topic];
  // nudge based on previous HI (if low, keep lower sentiment)
  const nudge = prevHI < 60 ? -10 : prevHI > 80 ? 10 : 0;
  const customerSentiment = clamp01(rand(lo, hi) + nudge);

  const textByTopic = {
    billing: [
      "Why is my bill higher this month?",
      "This charge makes no sense.",
      "I think I was overcharged.",
    ],
    network: [
      "Data is super slow in my area.",
      "Calls keep dropping.",
      "5G won't stick, it falls back to LTE.",
    ],
    device: [
      "My phone keeps freezing.",
      "Is this covered by warranty?",
      "Camera stopped working after update.",
    ],
    account: [
      "I can't login to my account.",
      "How do I change my plan?",
      "I need to add a new line.",
    ],
    care: [
      "The last agent wasn't helpful.",
      "I need to speak to a supervisor.",
      "Can you escalate this?",
    ],
  };

  const text = textByTopic[topic][Math.floor(Math.random() * textByTopic[topic].length)];

  return {
    id: crypto.randomUUID(),
    ts: Date.now(),
    role: "customer",
    text,
    topic,
    region,
    customerSentiment,
  };
}

// generate an agent response w/ AQ and projected HI
function genAgentTurn(customer, prevConfirmedHI) {
  // Agent quality boosts more when customer sentiment is low
  const empathy = customer.customerSentiment < 50 ? rand(75, 95) : rand(60, 85);
  const ownership = rand(65, 95);
  const nextStep = rand(70, 95);
  const latencyPenalty = rand(-5, 0);
  const agentQuality = clamp01((empathy * 0.45 + ownership * 0.25 + nextStep * 0.30) + latencyPenalty);

  // Projected HI before next customer response
  const projectedHI = clamp01(0.7 * (customer.customerSentiment ?? 50) + 0.3 * agentQuality);

  const responseByTopic = {
    billing: [
      "I'm sorry about the confusion—I'll review your charges right now and correct any errors.",
      "Thanks for flagging this. I can itemize the bill and apply any necessary credits.",
    ],
    network: [
      "Sorry for the trouble. I'll check your area and optimize your line settings now.",
      "I understand how frustrating that is. Let me run diagnostics and adjust your network profile.",
    ],
    device: [
      "Let's fix this together. I'll guide you through a quick reset and warranty check.",
      "I can schedule a repair or instant exchange if needed—your choice.",
    ],
    account: [
      "I can help you change plans and review the best options for your usage.",
      "Let's reset your login securely and enable multi-factor to prevent future lockouts.",
    ],
    care: [
      "I'm truly sorry about your previous experience. I'll take ownership and resolve this now.",
      "Thank you for your patience—I'll make this right and follow up personally.",
    ],
  };

  const text = responseByTopic[customer.topic][
    Math.floor(Math.random() * responseByTopic[customer.topic].length)
  ];

  return {
    id: crypto.randomUUID(),
    ts: Date.now(),
    role: "agent",
    text,
    topic: customer.topic,
    region: customer.region,
    agentQuality,
    projectedHI,
  };
}

function computeConfirmedHI(turns) {
  // Confirmed HI is computed after each customer turn based on latest CS and previous AQ
  const lastCustomer = [...turns].reverse().find((t) => t.role === "customer");
  const lastAgent = [...turns].reverse().find((t) => t.role === "agent");
  const cs = lastCustomer?.customerSentiment ?? 60;
  const aq = lastAgent?.agentQuality ?? 70;
  return clamp01(0.7 * cs + 0.3 * aq);
}

// -----------------------------
// UI Components
// -----------------------------

function KPI({ label, value, sub, icon }) {
  return (
    <Card className="rounded-2xl bg-white border border-rose-200 shadow-[0_10px_30px_rgba(226,0,116,0.08)]">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-500">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-4xl font-bold tracking-tight text-slate-900 drop-shadow">{value}</div>
        {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
      </CardContent>
    </Card>
  )
}

function TrendChart({ data }) {
  const formatted = data.map((d) => ({ time: formatClock(d.ts), Confirmed: d.confirmed, Projected: d.projected }));
  return (
    <Card className="rounded-2xl bg-white border border-rose-200 shadow-[0_10px_30px_rgba(226,0,116,0.08)]">
      <CardHeader className="pb-2">
        <CardTitle>Happiness Index – Real‑time Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer>
            <LineChart data={formatted}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
              <XAxis dataKey="time" tick={{ fontSize: 12, fill: 'rgba(0,0,0,0.7)' }} stroke="rgba(0,0,0,0.2)" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: 'rgba(0,0,0,0.7)' }} stroke="rgba(0,0,0,0.2)" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="Confirmed" dot={false} strokeWidth={2} stroke="#E20074" />
              <Line type="monotone" dataKey="Projected" dot={false} strokeWidth={2} stroke="#FF9AD5" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function TopicBar({ counts }) {
  const data = Object.entries(counts).map(([k, v]) => ({ topic: TOPIC_LABEL[k], count: v }));
  return (
    <Card className="rounded-2xl bg-white border border-rose-200 shadow-[0_10px_30px_rgba(226,0,116,0.08)]">
      <CardHeader className="pb-2">
        <CardTitle>Issues by Topic (last 15m)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
              <XAxis dataKey="topic" tick={{ fontSize: 12, fill: 'rgba(0,0,0,0.7)' }} stroke="rgba(0,0,0,0.2)" />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'rgba(0,0,0,0.7)' }} stroke="rgba(0,0,0,0.2)" />
              <Tooltip />
              <Bar dataKey="count" fill="#E20074" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function LiveFeed({ turns }) {
  const last20 = turns.slice(-20).reverse();
  return (
    <Card className="rounded-2xl bg-white border border-rose-200 shadow-[0_10px_30px_rgba(226,0,116,0.08)]">
      <CardHeader className="pb-2">
        <CardTitle>Live Conversation Feed</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {last20.map((t) => (
          <div key={t.id} className="grid grid-cols-12 gap-2 items-start border rounded-xl p-3">
            <div className="col-span-2 flex items-center gap-2">
              {t.role === "customer" ? (
                <Badge className="text-xs bg-[#E20074] hover:bg-[#c60063] text-white">Customer</Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">Agent</Badge>
              )}
              <Badge className="text-xs border border-rose-300 text-rose-800">
                {TOPIC_LABEL[t.topic]}
              </Badge>
            </div>
            <div className="col-span-7">
              <div className="text-sm">{t.text}</div>
              <div className="text-[10px] text-slate-500 mt-1">{formatClock(t.ts)} • {t.region}</div>
            </div>
            <div className="col-span-3 text-right space-y-1">
              {t.role === "customer" && (
                <Badge className="text-xs" variant={t.customerSentiment >= 70 ? "default" : t.customerSentiment >= 50 ? "secondary" : "destructive"}>
                  CS {Math.round(t.customerSentiment)}
                </Badge>
              )}
              {t.role === "agent" && (
                <>
                  <Badge className="text-xs" variant={t.agentQuality >= 80 ? "default" : "secondary"}>AQ {Math.round(t.agentQuality)}</Badge>
                  <Badge className="text-xs" variant="outline">Projected {Math.round(t.projectedHI)}</Badge>
                </>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Alerts({ series }) {
  const latest = series.at(-1);
  const prev = series.at(-6); // ~ last 6 points window
  const drop = latest && prev ? Math.round(prev.confirmed - latest.confirmed) : 0;
  const showAlert = latest && drop >= 15;
  if (!latest) return null;
  return (
    <Card className="rounded-2xl bg-white border border-rose-200 shadow-[0_10px_30px_rgba(226,0,116,0.08)]">
      <CardHeader className="pb-2">
        <CardTitle>Early Warning</CardTitle>
      </CardHeader>
      <CardContent>
        {showAlert ? (
          <Alert variant="destructive" className="rounded-xl">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Sentiment Drop Detected</AlertTitle>
            <AlertDescription>
              Happiness Index dropped by {drop} points in the last window. Investigate recent conversations and common topics.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="rounded-xl">
            <Smile className="h-4 w-4" />
            <AlertTitle>Stable</AlertTitle>
            <AlertDescription>No significant negative trend detected.</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// -----------------------------
// Main Component
// -----------------------------

export default function DashboardDemo() {
  const [turns, setTurns] = useState([]);
  const [series, setSeries] = useState([]);
  const [regionFilter, setRegionFilter] = useState("All Regions");
  const [running, setRunning] = useState(true);

  // seed
  useEffect(() => {
    if (turns.length === 0) {
      // 1) first customer speaks → compute Confirmed HI
      const seedCust = genCustomerTurn(70);
      const confirmed = computeConfirmedHI([seedCust]);
      // 2) agent responds → compute Projected HI
      const seedAgent = genAgentTurn(seedCust, confirmed);
      const projected = seedAgent.projectedHI ?? confirmed;

      setTurns([seedCust, seedAgent]);
      setSeries([
        { ts: Date.now(), confirmed, projected },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // generator loop
  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => {
      setTurns((prev) => {
        const lastConfirmed = series.at(-1)?.confirmed ?? 70;

        // 1) Customer speaks → update Confirmed HI
        const cust = genCustomerTurn(lastConfirmed);
        const confirmed = computeConfirmedHI([...prev, cust]);

        // 2) Agent responds → update Projected HI
        const agent = genAgentTurn(cust, confirmed);
        const projected = agent.projectedHI ?? confirmed;

        const next = [...prev, cust, agent];
        setSeries((s) => [...s.slice(-49), { ts: Date.now(), confirmed, projected }]);
        return next.slice(-60);
      });
    }, 2000);
    return () => clearInterval(iv);
  }, [running, series]);

  const filteredTurns = useMemo(() => {
    if (regionFilter === "All Regions") return turns;
    return turns.filter((t) => t.region === regionFilter);
  }, [turns, regionFilter]);

  const latestConfirmed = series.at(-1)?.confirmed ?? 70;
  const latestProjected = series.at(-1)?.projected ?? latestConfirmed;

  const topicCounts = { billing: 0, network: 0, device: 0, account: 0, care: 0 };
  filteredTurns.forEach((t) => {
    if (t.role === "customer") topicCounts[t.topic] += 1;
  });

  const csLatest = (() => {
    const lastCust = [...filteredTurns].reverse().find((t) => t.role === "customer");
    return lastCust?.customerSentiment ?? 65;
  })();

  const aqLatest = (() => {
    const lastAgent = [...filteredTurns].reverse().find((t) => t.role === "agent");
    return lastAgent?.agentQuality ?? 78;
  })();

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-rose-50 to-white text-slate-900 p-6 md:p-10 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-[#E20074] to-[#FF77C8] bg-clip-text text-transparent">Chatbot Happiness Dashboard</h1>
          <p className="text-slate-600">Real‑time customer sentiment from chatbot conversations (Projected vs Confirmed).</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="border border-rose-300 bg-white text-slate-900 rounded-xl h-10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E20074]/60"
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
          >
            <option>All Regions</option>
            {REGIONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <Button className="rounded-xl bg-[#E20074] hover:bg-[#c60063] text-white border-0" onClick={() => setRunning((r) => !r)}>
            <RefreshCw className="h-4 w-4 mr-2" /> {running ? "Pause" : "Resume"}
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPI label="Happiness Index" value={`${Math.round(latestConfirmed)}`} sub="Confirmed" icon={<Activity className="h-4 w-4 text-muted-foreground" />} />
        <KPI label="Projected HI" value={`${Math.round(latestProjected)}`} sub="After last agent response" icon={<Signal className="h-4 w-4 text-muted-foreground" />} />
        <KPI label="Customer Sentiment" value={`${Math.round(csLatest)}`} sub="Latest customer turn" icon={<Frown className="h-4 w-4 text-muted-foreground" />} />
        <KPI label="Agent Quality" value={`${Math.round(aqLatest)}`} sub="Latest agent turn" icon={<Smile className="h-4 w-4 text-muted-foreground" />} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <TrendChart data={series} />
        </div>
        <TopicBar counts={topicCounts} />
      </div>

      {/* Alerts + Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Alerts series={series} />
        <LiveFeed turns={filteredTurns} />
      </div>

      {/* Footer Note */}
      <div className="text-xs text-slate-500 text-center pt-2">
        * Projected HI updates right after an agent response. Confirmed HI updates after the next customer turn.
      </div>
    </div>
  );
}
