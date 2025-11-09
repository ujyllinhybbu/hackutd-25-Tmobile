// server/metrics.js
import express from "express";
import Ticket from "./models/Ticket.js";

const router = express.Router();

router.get("/metrics", async (_req, res) => {
  const now = new Date();
  const d7 = new Date(now);
  d7.setDate(d7.getDate() - 7);
  const d30 = new Date(now);
  d30.setDate(d30.getDate() - 30);

  const [cnt7, cnt30] = await Promise.all([
    Ticket.countDocuments({ createdAt: { $gte: d7 } }),
    Ticket.countDocuments({ createdAt: { $gte: d30 } }),
  ]);

  res.json({
    avg7d: Math.round(cnt7 / 7),
    avg30d: Math.round(cnt30 / 30),
  });
});

export default router;
