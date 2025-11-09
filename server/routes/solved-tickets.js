// server/routes/solved-tickets.js
import express from "express";
import Ticket from "../models/Ticket.js";

const router = express.Router();

const score = (s) => (Ticket.sentimentScore ? Ticket.sentimentScore(s) : 0);

/**
 * GET /api/tickets/solved?limit=20
 * -> { items: [{ _id, title, city, severity, closedAt, aiSummary, aiSentiment, aiScore, aiKeywords }] }
 */
router.get("/tickets/solved", async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 20)));

    const docs = await Ticket.find({ status: "fixed" })
      .sort({ closedAt: -1, updatedAt: -1 })
      .limit(limit)
      .select({
        title: 1,
        city: 1,
        severity: 1,
        closedAt: 1,
        aiSummary: 1,
        aiSentiment: 1,
        aiKeywords: 1,
        createdAt: 1,
        updatedAt: 1,
      })
      .lean();

    const items = docs.map((t) => ({
      _id: String(t._id),
      title: t.title || "Untitled",
      city: t.city || "",
      severity: t.severity || "minor",
      closedAt: t.closedAt || t.updatedAt || t.createdAt,
      aiSummary: t.aiSummary || "",
      aiSentiment: t.aiSentiment || "neutral",
      aiScore: score(t.aiSentiment),
      aiKeywords: (t.aiKeywords || []).map(String),
    }));

    res.json({ items });
  } catch (e) {
    console.error("solved list error:", e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
