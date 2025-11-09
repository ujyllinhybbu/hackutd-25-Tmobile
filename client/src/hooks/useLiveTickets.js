import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import axios from "axios";

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export default function useLiveTickets(serverUrl = "/") {
  const [stats, setStats] = useState(null);
  const [happiness, setHappiness] = useState(100);

  // Sentiment series (Happiness Index)
  const [series, setSeries] = useState([]); // [{ ts, confirmed, projected }]

  // NEW: Ops time-series (avg active / resolution minutes)
  const [opsSeries, setOpsSeries] = useState([]); // [{ ts, activeMin, resolutionMin }]

  // Recent severity counts (from ticket:created events)
  const [severityCounts, setSeverityCounts] = useState({
    minor: 0,
    major: 0,
    critical: 0,
  });

  // Live log
  const [log, setLog] = useState([{ ts: Date.now(), text: "Connecting..." }]);

  // NEW: created-today timestamps (for projection + hourly)
  const [createdToday, setCreatedToday] = useState([]);

  // NEW: historical metrics if backend provides /api/metrics
  const [metrics, setMetrics] = useState({
    avg7d: null,
    avg30d: null,
  });

  const socketRef = useRef(null);
  const addLog = (text) =>
    setLog((prev) => [{ ts: Date.now(), text }, ...prev].slice(0, 400));

  // Try fetch historical averages once (soft-fail ok)
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get("/api/metrics");
        if (res?.data) {
          setMetrics({
            avg7d: Number(res.data.avg7d ?? res.data.sevenDayAvg ?? null),
            avg30d: Number(res.data.avg30d ?? res.data.thirtyDayAvg ?? null),
          });
        }
      } catch {
        // backend may not have /api/metrics — that's fine
      }
    })();
  }, []);

  // Midnight reset for createdToday buffer
  useEffect(() => {
    const id = setInterval(() => {
      if (Date.now() - startOfToday() < 1200) {
        setCreatedToday([]);
      }
    }, 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Socket wiring
  useEffect(() => {
    const socket = io(serverUrl, { withCredentials: false });
    socketRef.current = socket;

    socket.on("connect", () => addLog(`✅ connected ${socket.id}`));
    socket.on("disconnect", () => addLog("❌ disconnected"));

    socket.on("live:stats", (s) => {
      addLog(`📊 stats: ${JSON.stringify(s)}`);
      setStats(s);

      const h = s.happiness ?? 100;
      setHappiness(h);

      // Sentiment time series
      setSeries((prev) => [
        ...prev.slice(-199),
        { ts: Date.now(), confirmed: h, projected: h },
      ]);

      // Ops time series
      setOpsSeries((prev) => [
        ...prev.slice(-199),
        {
          ts: Date.now(),
          activeMin: Number(s.avgActiveMinutes ?? 0),
          resolutionMin: Number(s.avgResolutionMinutes ?? 0),
        },
      ]);
    });

    socket.on("ticket:created", (t) => {
      addLog(`🆕 ticket: ${t.title} (${t.severity})`);
      if (t?.severity) {
        setSeverityCounts((c) => ({
          ...c,
          [t.severity]: (c[t.severity] || 0) + 1,
        }));
      }
      const now = Date.now();
      if (now >= startOfToday()) {
        setCreatedToday((arr) => [...arr, now]);
      }
    });

    socket.on("ticket:closed", (t) => addLog(`✅ ticket closed: ${t.title}`));
    socket.on("ticket:updated", (t) =>
      addLog(`✳️ ticket updated: ${JSON.stringify(t)}`)
    );

    socket.on("happiness:update", ({ happiness: h }) => {
      addLog(`💖 happiness update: ${h}`);
      setHappiness(h);
      setSeries((prev) => [
        ...prev.slice(-199),
        { ts: Date.now(), confirmed: h, projected: h },
      ]);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [serverUrl]);

  // REST actions
  const actions = {
    createTicket: async ({ title, city, severity }) => {
      const res = await axios.post("/api/test-ticket", {
        title,
        city,
        severity,
      });
      // return entire payload so caller can prefill _id if needed
      return res.status >= 200 && res.status < 300 ? res.data ?? true : false;
    },
    closeTicket: async (id) => {
      try {
        return await axios.patch(`/api/tickets/${id.trim()}/close`);
      } catch (e) {
        return e.response ?? { status: 500, data: { error: "network" } };
      }
    },
  };

  const happyPct = useMemo(
    () => Math.max(0, Math.min(100, happiness)),
    [happiness]
  );

  // --- Derived analytics for Business Insights ---
  const todayCount = createdToday.length;

  // Use 24h projection by default (or change businessHours to 12 for 8a–8p)
  const elapsedMs = Date.now() - startOfToday();
  const elapsedHours = Math.max(0.25, elapsedMs / 3_600_000);
  const businessHours = 24;
  const projectedToday = Math.round(
    (todayCount / elapsedHours) * businessHours
  );

  const deltaVs7d = metrics.avg7d
    ? Math.round(((todayCount - metrics.avg7d) / metrics.avg7d) * 100)
    : null;

  const hourlyToday = Array.from({ length: 24 }, (_, h) => ({
    hour: `${String(h).padStart(2, "0")}:00`,
    count: createdToday.filter((ts) => new Date(ts).getHours() === h).length,
  }));

  return {
    stats,
    happiness: happyPct,
    series,
    severityCounts,
    log,
    actions,

    // Business analytics
    metrics, // { avg7d, avg30d }
    todayCount,
    projectedToday,
    deltaVs7d,
    hourlyToday,

    // Ops series
    opsSeries,
  };
}
