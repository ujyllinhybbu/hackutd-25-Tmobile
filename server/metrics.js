// metrics.js
import { Router } from "express";
import mongoose from "mongoose";
import Ticket from "./models/Ticket.js";

const router = Router();

/**
 * /api/metrics/summary
 * Returns:
 *  - todayCount
 *  - projectedToday (based on current rate)
 *  - avg7d, avg30d (per-day)
 *  - deltaVs7d (%)
 *  - hourlyToday: [{hour:'00', count:n}, ...]
 */
router.get("/metrics/summary", async (_req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const start7d = new Date(now);
    start7d.setDate(start7d.getDate() - 7);
    start7d.setHours(0, 0, 0, 0);

    const start30d = new Date(now);
    start30d.setDate(start30d.getDate() - 30);
    start30d.setHours(0, 0, 0, 0);

    // today count
    const todayCount = await Ticket.countDocuments({
      createdAt: { $gte: startOfToday, $lte: now },
    });

    // hourly breakdown today
    const hourlyAgg = await Ticket.aggregate([
      { $match: { createdAt: { $gte: startOfToday, $lte: now } } },
      {
        $group: {
          _id: {
            hour: { $hour: { date: "$createdAt", timezone: "UTC" } },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.hour": 1 } },
    ]);

    // Build 24 buckets local-time labels
    const hours = [...Array(24)].map((_, h) => ({
      hour: String(h).padStart(2, "0"),
      count: 0,
    }));
    const offsetHours = now.getTimezoneOffset() / 60; // negative in US
    hourlyAgg.forEach((row) => {
      const utcHour = row._id.hour;
      // shift to local hour index
      let localHour = (utcHour - offsetHours) % 24;
      if (localHour < 0) localHour += 24;
      hours[localHour].count = row.count;
    });

    // avg 7d, 30d
    const total7d = await Ticket.countDocuments({
      createdAt: { $gte: start7d, $lte: now },
    });
    const total30d = await Ticket.countDocuments({
      createdAt: { $gte: start30d, $lte: now },
    });
    const avg7d = +(total7d / 7).toFixed(1);
    const avg30d = +(total30d / 30).toFixed(1);

    // projected today (rate so far * 24h)
    const elapsedMs = now.getTime() - startOfToday.getTime();
    const projectedToday =
      elapsedMs > 0
        ? Math.round((todayCount / (elapsedMs / 3600000)) * 24)
        : todayCount;

    const deltaVs7d =
      avg7d > 0 ? Math.round(((todayCount - avg7d) / avg7d) * 100) : null;

    res.json({
      todayCount,
      projectedToday,
      avg7d,
      avg30d,
      deltaVs7d,
      hourlyToday: hours,
    });
  } catch (err) {
    console.error("metrics/summary error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * /api/metrics/ops-series
 * Returns a short time series for charts:
 * [
 *   { ts, activeMin, resolutionMin }
 * ]
 * We compute rolling snapshots for the last ~12 hours (every hour).
 */
router.get("/metrics/ops-series", async (_req, res) => {
  try {
    const now = new Date();
    const points = [];

    // build hour marks for the last 12 hours
    for (let i = 11; i >= 0; i--) {
      const ts = new Date(now.getTime() - i * 3600000);
      const windowEnd = ts;
      const windowStart = new Date(windowEnd.getTime() - 3600000); // 1h window

      // Avg active time for tickets open during the window (approx)
      const openTickets = await Ticket.find({
        status: { $ne: "fixed" },
        createdAt: { $lte: windowEnd },
      }).select("createdAt");
      let avgActiveMs = 0;
      if (openTickets.length) {
        const total = openTickets.reduce(
          (s, t) => s + (windowEnd.getTime() - t.createdAt.getTime()),
          0
        );
        avgActiveMs = total / openTickets.length;
      }

      // Avg resolution time among tickets fixed in this window
      const fixedTickets = await Ticket.find({
        status: "fixed",
        updatedAt: { $gte: windowStart, $lte: windowEnd },
      }).select("createdAt updatedAt");
      let avgResolutionMs = 0;
      if (fixedTickets.length) {
        const total = fixedTickets.reduce(
          (s, t) => s + (t.updatedAt.getTime() - t.createdAt.getTime()),
          0
        );
        avgResolutionMs = total / fixedTickets.length;
      }

      points.push({
        ts: windowEnd.getTime(),
        activeMin: +(avgActiveMs / 60000).toFixed(1),
        resolutionMin: +(avgResolutionMs / 60000).toFixed(1),
      });
    }

    res.json(points);
  } catch (err) {
    console.error("metrics/ops-series error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
