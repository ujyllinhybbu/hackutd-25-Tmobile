import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
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
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function genCustomerTurn(prevHI) {
  const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
  const region = REGIONS[Math.floor(Math.random() * REGIONS.length)];
  const baseByTopic = {
    billing: [30, 60],
    network: [25, 55],
    device: [40, 70],
    account: [45, 80],
    care: [35, 65],
  };
  const [lo, hi] = baseByTopic[topic];
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

  const text =
    textByTopic[topic][Math.floor(Math.random() * textByTopic[topic].length)];

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

function genAgentTurn(customer) {
  const empathy = customer.customerSentiment < 50 ? rand(75, 95) : rand(60, 85);
  const ownership = rand(65, 95);
  const nextStep = rand(70, 95);
  const latencyPenalty = rand(-5, 0);
  const agentQuality = clamp01(
    empathy * 0.45 + ownership * 0.25 + nextStep * 0.3 + latencyPenalty
  );
  const projectedHI = clamp01(
    0.7 * (customer.customerSentiment ?? 50) + 0.3 * agentQuality
  );

  const responseByTopic = {
    billing: [
      "I'm sorry about the confusion—I'll review your charges and correct any errors.",
      "Thanks for flagging this. I can itemize the bill and apply credits.",
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

  const text =
    responseByTopic[customer.topic][
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
  const lastCustomer = [...turns].reverse().find((t) => t.role === "customer");
  const lastAgent = [...turns].reverse().find((t) => t.role === "agent");
  const cs = lastCustomer?.customerSentiment ?? 60;
  const aq = lastAgent?.agentQuality ?? 70;
  return clamp01(0.7 * cs + 0.3 * aq);
}

function KPI({ label, value, sub, icon }) {
  return (
    <Card className="flex flex-col justify-between rounded-2xl border border-white/20 bg-white/40 backdrop-blur-lg shadow-[0_8px_25px_rgba(226,0,116,0.25)]">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-800">
          {label}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-3xl sm:text-4xl font-bold tracking-tight text-[#E20074] drop-shadow-sm">
          {value}
        </div>
        {sub && <div className="text-xs text-slate-600 mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function TrendChart({ data }) {
  const formatted = data.map((d) => ({
    time: formatClock(d.ts),
    Confirmed: d.confirmed,
    Projected: d.projected,
  }));
  return (
    <Card className="rounded-2xl border border-white/20 bg-white/40 backdrop-blur-lg shadow-[0_8px_25px_rgba(226,0,116,0.25)]">
      <CardHeader className="pb-2">
        <CardTitle>Happiness Index – Real-time Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] sm:h-[350px] md:h-[400px] w-full">
          <ResponsiveContainer>
            <LineChart data={formatted}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
              <XAxis dataKey="time" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="Confirmed"
                dot={false}
                strokeWidth={3}
                stroke="#E20074"
              />
              <Line
                type="monotone"
                dataKey="Projected"
                dot={false}
                strokeWidth={3}
                stroke="#FF9AD5"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function TopicBar({ counts }) {
  const data = Object.entries(counts).map(([k, v]) => ({
    topic: TOPIC_LABEL[k],
    count: v,
  }));
  return (
    <Card className="rounded-2xl border border-white/20 bg-white/40 backdrop-blur-lg shadow-[0_8px_25px_rgba(226,0,116,0.25)]">
      <CardHeader className="pb-2">
        <CardTitle>Issues by Topic (last 15m)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] sm:h-[350px] md:h-[400px] w-full">
          <ResponsiveContainer>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
              <XAxis dataKey="topic" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#E20074" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function Alerts({ series }) {
  const latest = series.at(-1);
  const prev = series.at(-6);
  const drop =
    latest && prev ? Math.round(prev.confirmed - latest.confirmed) : 0;
  const showAlert = latest && drop >= 15;
  if (!latest) return null;
  return (
    <Card className="rounded-2xl border border-white/20 bg-white/40 backdrop-blur-lg shadow-[0_8px_25px_rgba(226,0,116,0.25)]">
      <CardHeader className="pb-2">
        <CardTitle>Early Warning</CardTitle>
      </CardHeader>
      <CardContent>
        {showAlert ? (
          <Alert
            variant="destructive"
            className="rounded-xl bg-[#E20074]/20 text-[#E20074] border-[#E20074]/40 backdrop-blur-md"
          >
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Sentiment Drop Detected</AlertTitle>
            <AlertDescription>
              Happiness Index dropped by {drop} points recently. Investigate
              common topics.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="rounded-xl bg-white/50 backdrop-blur-md border-white/20 text-slate-800">
            <Smile className="h-4 w-4" />
            <AlertTitle>Stable</AlertTitle>
            <AlertDescription>
              No significant negative trend detected.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardDemo() {
  const [turns, setTurns] = useState([]);
  const [series, setSeries] = useState([]);
  const [regionFilter, setRegionFilter] = useState("All Regions");
  const [running, setRunning] = useState(true);

  useEffect(() => {
    if (turns.length === 0) {
      const seedCust = genCustomerTurn(70);
      const confirmed = computeConfirmedHI([seedCust]);
      const seedAgent = genAgentTurn(seedCust, confirmed);
      const projected = seedAgent.projectedHI ?? confirmed;
      setTurns([seedCust, seedAgent]);
      setSeries([{ ts: Date.now(), confirmed, projected }]);
    }
  }, []);

  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => {
      setTurns((prev) => {
        const lastConfirmed = series.at(-1)?.confirmed ?? 70;
        const cust = genCustomerTurn(lastConfirmed);
        const confirmed = computeConfirmedHI([...prev, cust]);
        const agent = genAgentTurn(cust, confirmed);
        const projected = agent.projectedHI ?? confirmed;
        const next = [...prev, cust, agent];
        setSeries((s) => [
          ...s.slice(-49),
          { ts: Date.now(), confirmed, projected },
        ]);
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
  const topicCounts = Object.fromEntries(TOPICS.map((t) => [t, 0]));
  filteredTurns.forEach((t) => {
    if (t.role === "customer") topicCounts[t.topic] += 1;
  });

  const csLatest =
    [...filteredTurns].reverse().find((t) => t.role === "customer")
      ?.customerSentiment ?? 65;
  const aqLatest =
    [...filteredTurns].reverse().find((t) => t.role === "agent")
      ?.agentQuality ?? 78;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#E20074]/10 via-white/60 to-[#FFB7E6]/30 text-slate-900 px-4 sm:px-6 md:px-10 py-6 space-y-6 w-full overflow-x-hidden backdrop-blur-3xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-[#E20074] to-[#FF77C8] bg-clip-text text-transparent drop-shadow-sm">
            T-Mobile AI Dashboard
          </h1>
          <p className="text-slate-700 text-sm md:text-base">
            Real-time sentiment and agent performance — rendered in Apple-style
            glass UI.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="border border-white/40 bg-white/40 backdrop-blur-md text-slate-900 rounded-xl h-10 px-3 text-sm focus:ring-2 focus:ring-[#E20074]/40"
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
          >
            <option>All Regions</option>
            {REGIONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <Button
            className="rounded-xl bg-[#E20074] hover:bg-[#c60063] text-white border-0 shadow-[0_4px_20px_rgba(226,0,116,0.4)]"
            onClick={() => setRunning((r) => !r)}
          >
            <RefreshCw className="h-4 w-4 mr-2" />{" "}
            {running ? "Pause" : "Resume"}
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
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
          label="Customer Sentiment"
          value={`${Math.round(csLatest)}`}
          sub="Latest customer"
          icon={<Frown />}
        />
        <KPI
          label="Agent Quality"
          value={`${Math.round(aqLatest)}`}
          sub="Latest agent"
          icon={<Smile />}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <TrendChart data={series} />
        </div>
        <TopicBar counts={topicCounts} />
      </div>

      {/* Alerts + Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Alerts series={series} />
      </div>
    </div>
  );
}
