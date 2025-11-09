// server.js
import express from "express";
import dotenv from "dotenv";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import mongoose from "mongoose";
import OpenAI from "openai";
import { connectDB } from "./db/connectToDB.js";
import Ticket from "./models/Ticket.js";
import ChatMessage from "./models/ChatMessage.js";
import metricsRouter from "./metrics.js";
import solvedTicketsRouter from "./routes/solved-tickets.js";

dotenv.config();

// --- OpenAI (optional) ---
const openaiApiKey = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY;
if (!openaiApiKey) {
  console.warn(
    "OpenAI API key not found. AI replies disabled. Set OPENAI_API_KEY."
  );
}
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;
console.log(
  openai ? "OpenAI client initialized" : "OpenAI client not initialized"
);

// --- Express ---
const app = express();
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});
app.use(express.json());
app.use(express.static("public"));
app.use("/api", metricsRouter);
app.use("/api", solvedTicketsRouter);

// --- HTTP + Socket.IO ---
const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: "*" } });

// --- In-memory metrics ---
let happiness = 100;
const activateAgentTickets = new Map(); // ticketId -> last agent activity ms

// ---------- AI context helpers ----------
function estimateTokens(str = "") {
  return Math.ceil((str || "").length / 4); // coarse estimate
}

async function fetchRecentMessages(ticketId, limit = 50) {
  const msgs = await ChatMessage.find({
    ticketId: new mongoose.Types.ObjectId(String(ticketId)),
  })
    .sort({ createdAt: 1 })
    .limit(limit);

  return msgs.map((m) => ({
    id: String(m._id),
    authorType: m.authorType, // 'user' | 'staff' | 'bot'
    authorName: m.authorName || m.authorType,
    text: m.text || "",
    createdAt: m.createdAt,
  }));
}

function buildMessagesForOpenAI({
  systemPrompt,
  ticket,
  history,
  modelMaxTokens = 12000,
  responseTokens = 500,
}) {
  const headroom = modelMaxTokens - responseTokens;

  const messages = [{ role: "system", content: systemPrompt.trim() }];

  const ctxParts = [];
  if (ticket?.title) ctxParts.push(`Issue: ${ticket.title}`);
  if (ticket?.city) ctxParts.push(`City: ${ticket.city}`);
  if (Array.isArray(ticket?.aiKeywords) && ticket.aiKeywords.length)
    ctxParts.push(`Keywords: ${ticket.aiKeywords.join(", ")}`);
  if (ticket?.aiSentiment)
    ctxParts.push(`Prev sentiment: ${ticket.aiSentiment}`);

  const contextBlock = ctxParts.length
    ? `Ticket context — ${ctxParts.join(" · ")}`
    : "Ticket context — (none)";
  messages.push({ role: "system", content: contextBlock });

  const mapRole = (t) => (t === "user" ? "user" : "assistant");
  const convo = [];
  let used = estimateTokens(systemPrompt) + estimateTokens(contextBlock);

  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    const role = mapRole(h.authorType || "user");
    const line = `${h.authorName || role}: ${h.text}`;
    const tk = estimateTokens(line) + 4;
    if (used + tk > headroom) break;
    used += tk;
    convo.unshift({ role, content: line });
  }

  if (convo.length === 0) {
    convo.push({ role: "user", content: "User started a new ticket." });
  }

  return messages.concat(convo);
}

// ---------- Stats helpers ----------
async function computeStats() {
  const total = await Ticket.countDocuments();
  const open = await Ticket.countDocuments({ status: { $ne: "fixed" } });
  const fixed = await Ticket.countDocuments({ status: "fixed" });
  const flagged = await Ticket.countDocuments({ flagged: true });

  const bySeverity = await Ticket.aggregate([
    { $group: { _id: "$severity", count: { $sum: 1 } } },
  ]);
  const severityCounts = { minor: 0, major: 0, critical: 0 };
  for (const row of bySeverity) severityCounts[row._id] = row.count || 0;

  const recentClosed = await Ticket.find({ status: "fixed" })
    .sort({ updatedAt: -1 })
    .limit(200);

  let avgResolutionMs = 0;
  if (recentClosed.length) {
    const totalMs = recentClosed.reduce(
      (s, t) => s + (t.updatedAt - t.createdAt),
      0
    );
    avgResolutionMs = totalMs / recentClosed.length;
  }

  const openTickets = await Ticket.find({ status: { $ne: "fixed" } }).select(
    "createdAt"
  );
  let avgActiveMs = 0;
  if (openTickets.length) {
    const now = Date.now();
    const totalMs = openTickets.reduce(
      (s, t) => s + (now - t.createdAt.getTime()),
      0
    );
    avgActiveMs = totalMs / openTickets.length;
  }

  return {
    total,
    open,
    fixed,
    flagged,
    severityCounts,
    avgActiveMinutes: +(avgActiveMs / 60000).toFixed(1),
    avgResolutionMinutes: +(avgResolutionMs / 60000).toFixed(1),
    happiness,
  };
}
async function computeAndEmitStats() {
  try {
    const payload = await computeStats();
    io.emit("live:stats", payload);
  } catch (err) {
    console.error("Error computing stats:", err.message);
  }
}

// ---------- Meta broadcast helpers ----------
function emitTicketMeta(ticket) {
  io.emit("ticket:meta", {
    id: String(ticket._id),
    messageCount: ticket.messageCount,
    lastMessageSnippet: ticket.lastMessageSnippet,
    lastMessageAt: ticket.lastMessageAt,
    flagged: !!ticket.flagged,
    flaggedAt: ticket.flaggedAt || null,
    // also broadcast AI fields for live dashboards
    aiSentiment: ticket.aiSentiment || "neutral",
    aiKeywords: Array.isArray(ticket.aiKeywords) ? ticket.aiKeywords : [],
    aiSummary: ticket.aiSummary || "",
  });
}

async function updateTicketMetaAndEmit(ticket, latestText) {
  ticket.lastMessageAt = new Date();
  ticket.lastMessageSnippet = (latestText || "").slice(0, 120);
  ticket.messageCount = (ticket.messageCount || 0) + 1;
  await ticket.save();
  emitTicketMeta(ticket);
}

// ---------- Centralized message writer ----------
async function addMessage({
  ticketId,
  authorType = "user",
  authorName = "Guest",
  text = "",
  triggerAI = false,
}) {
  if (!text.trim()) return null;

  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw new Error("Ticket not found");

  const msg = await ChatMessage.create({
    ticketId: new mongoose.Types.ObjectId(String(ticketId)),
    authorType,
    authorName,
    text,
  });

  const payload = {
    _id: msg._id,
    ticketId: String(msg.ticketId),
    authorType: msg.authorType,
    authorName: msg.authorName,
    text: msg.text,
    createdAt: msg.createdAt,
    updatedAt: msg.updatedAt,
  };

  const room = `ticket:${String(ticketId)}`;
  io.to(room).emit("chat:new", payload);
  io.to("support").emit("chat:new", payload);

  await updateTicketMetaAndEmit(ticket, text);

  if (authorType === "agent" || authorType === "staff") {
    activateAgentTickets.set(String(ticketId), Date.now());
  }

  // AI trigger (user-only, quiet 5m after agent message)
  if (triggerAI && openai && authorType === "user") {
    const last = activateAgentTickets.get(String(ticketId));
    const quiet = !last || Date.now() - last >= 5 * 60 * 1000;

    if (quiet) {
      void (async () => {
        try {
          const systemPrompt = `
You are a T-Mobile customer support assistant.

Respond ONLY in valid JSON with this exact shape:
{
  "reply": "<concise professional answer>",
  "sentiment": "<neutral|upset|happy|confused>",
  "flagged": <true|false>,
  "keywords": ["<keyword1>", "<keyword2>", "..."]
}

Rules:
- Only handle T-Mobile topics (accounts, billing, technical support, store info).
- Extract 1–5 short issue keywords (2–6 words each) from the user's message, e.g. "billing error", "network outage", "SIM issue", "payment declined", "5G not working".
- Always include the "keywords" array (empty if none).
- If the user seems angry/frustrated or uses negative language, set "sentiment": "upset".
- If "sentiment" is "upset", set "flagged": true (requires human follow-up).
- Also set "flagged": true if the issue needs human review or account access (billing adjustments, refunds, escalations, outages, identity/account verification).
- Keep "reply" concise, polite, and professional.
- If asked about non–T-Mobile topics:
  {
    "reply": "Sorry, I can only assist with T-Mobile related questions. If I can’t help you directly, a staff member will join soon.",
    "sentiment": "neutral",
    "flagged": true,
    "keywords": ["non-tmobile topic"]
  }
`.trim();

          // 1) Load recent history
          const history = await fetchRecentMessages(ticketId, 50);

          // 2) Compose OpenAI messages with trimmed history
          const oaMessages = buildMessagesForOpenAI({
            systemPrompt,
            ticket,
            history,
            modelMaxTokens: 12000,
            responseTokens: 500,
          });

          // 3) Call OpenAI
          const aiResp = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: oaMessages,
            max_tokens: 500,
            temperature: 0.4,
          });

          const raw = aiResp?.choices?.[0]?.message?.content?.trim() || "";
          let aiJson;
          try {
            aiJson = JSON.parse(raw);
          } catch {
            aiJson = {
              reply: raw || "Thanks—let me check that for you.",
              sentiment: "neutral",
              flagged: false,
              keywords: [],
            };
          }

          // Normalize + safety
          const botText = (aiJson.reply || "").toString().slice(0, 4000);
          const aiSentiment = (aiJson.sentiment || "neutral").toString();
          let flagged = Boolean(aiJson.flagged);
          const aiKeywords = Array.isArray(aiJson.keywords)
            ? aiJson.keywords
            : [];
          if (aiSentiment.toLowerCase() === "upset") flagged = true;

          // 4) Send bot message (broadcasts via chat:new)
          await ChatMessage.create({
            ticketId: new mongoose.Types.ObjectId(String(ticketId)),
            authorType: "bot",
            authorName: "AutoBot",
            text: botText,
          });
          const botPayload = {
            _id: new mongoose.Types.ObjectId(),
            ticketId: String(ticketId),
            authorType: "bot",
            authorName: "AutoBot",
            text: botText,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          io.to(`ticket:${String(ticketId)}`).emit("chat:new", botPayload);
          io.to("support").emit("chat:new", botPayload);

          // 5) Update ticket meta count/snippet + save AI fields
          ticket.lastMessageAt = new Date();
          ticket.lastMessageSnippet = botText.slice(0, 120);
          ticket.messageCount = (ticket.messageCount || 0) + 1;

          // ✅ Save AI fields for "Last Solved Issues" + dashboards
          ticket.aiSummary = botText.slice(0, 400);
          ticket.aiSentiment = aiSentiment;
          ticket.aiKeywords = aiKeywords;

          // Also keep analysis/flag used elsewhere
          ticket.sentiment = aiSentiment;
          ticket.keywords = aiKeywords;
          ticket.analyzedAt = new Date();

          if (flagged) {
            ticket.flagged = true;
            ticket.flaggedAt = new Date();
          }

          await ticket.save();

          // 6) Real-time updates for dashboards (no refresh needed)
          emitTicketMeta(ticket);
          io.emit("ticket:updated", {
            id: String(ticket._id),
            aiSentiment: ticket.aiSentiment,
            aiScore: sentimentScore(ticket.aiSentiment),
            aiKeywords: ticket.aiKeywords,
            aiSummary: ticket.aiSummary,
            lastMessageSnippet: ticket.lastMessageSnippet,
            messageCount: ticket.messageCount,
            flagged: ticket.flagged,
          });
          if (flagged) {
            io.to("support").emit("ticket:flagged", {
              ticketId: String(ticketId),
              sentiment: ticket.aiSentiment,
              flagged: true,
              keywords: ticket.aiKeywords,
              flaggedAt: ticket.flaggedAt,
            });
          }
        } catch (e) {
          console.error("OpenAI reply error:", e?.message || e);
        }
      })();
    }
  }

  return payload;
}

// Helper for aiScore here (mirrors model static)
function sentimentScore(s) {
  switch (String(s || "").toLowerCase()) {
    case "happy":
      return 5;
    case "upset":
      return -5;
    case "confused":
      return -2;
    case "neutral":
    default:
      return 0;
  }
}

// ---------- REST: test ticket ----------
app.post("/api/test-ticket", async (req, res) => {
  try {
    const {
      title = "Test ticket",
      city = "Dallas",
      severity = "minor",
      status = "open",
    } = req.body || {};
    const ticket = await Ticket.create({ title, city, severity, status });

    happiness = Math.max(0, happiness - 5);
    io.emit("happiness:update", { happiness });
    io.emit("ticket:created", ticket);
    await computeAndEmitStats();

    res.json({ success: true, ticket });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- REST: create ticket (welcome + initial issue + AI) ----------
app.post("/api/tickets", async (req, res) => {
  try {
    const {
      requesterName = "Guest",
      city = "Unknown",
      title = "Issue",
      description = "",
      severity = "minor",
    } = req.body || {};

    const ticket = await Ticket.create({
      title,
      description,
      city,
      severity,
      status: "open",
      createdBy: requesterName,
      messageCount: 0,
    });

    activateAgentTickets.delete(String(ticket._id));

    // 1) Welcome bot
    const welcomeText =
      "🤖 Chatbot will triage your issue and a specialist will join shortly.";
    await addMessage({
      ticketId: ticket._id,
      authorType: "bot",
      authorName: "AutoBot",
      text: welcomeText,
      triggerAI: false,
    });

    // 2) User initial message (title/description/city) + trigger AI
    const initialUserText =
      `**Issue:** ${title}\n\n` +
      `**Details:** ${description || "(no description)"}\n\n` +
      `**City:** ${city}`;
    await addMessage({
      ticketId: ticket._id,
      authorType: "user",
      authorName: requesterName,
      text: initialUserText,
      triggerAI: true,
    });

    happiness = Math.max(0, happiness - 5);
    io.emit("happiness:update", { happiness });
    io.emit("ticket:created", ticket);
    await computeAndEmitStats();

    res.json({ success: true, ticket });
  } catch (err) {
    console.error("Create ticket error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- REST: append chat message ----------
app.post("/api/tickets/:id/chat", async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    const {
      authorType = "user",
      authorName = "Guest",
      text = "",
    } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid ticket id" });
    }
    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res
        .status(404)
        .json({ success: false, message: "Ticket not found" });
    }
    if (!text.trim()) {
      return res.status(400).json({ success: false, message: "Text required" });
    }

    const payload = await addMessage({
      ticketId: id,
      authorType,
      authorName,
      text,
      triggerAI: authorType === "user",
    });

    res.json({ success: true, message: payload });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- REST: ticket message history ----------
app.get("/api/tickets/:id/messages", async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid ticket id" });
    }
    const msgs = await ChatMessage.find({
      ticketId: new mongoose.Types.ObjectId(id),
    }).sort({ createdAt: 1 });

    const normalized = msgs.map((m) => ({
      _id: String(m._id),
      ticketId: String(m.ticketId),
      authorType: m.authorType,
      authorName: m.authorName,
      text: m.text,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));
    res.json(normalized);
  } catch (err) {
    console.error("History error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- REST: toggle flag ----------
app.patch("/api/tickets/:id/flag", async (req, res) => {
  try {
    const id = String(req.params.id || "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid ticket id" });
    }
    const ticket = await Ticket.findById(id);
    if (!ticket)
      return res
        .status(404)
        .json({ success: false, message: "Ticket not found" });

    const { flagged = false } = req.body || {};
    ticket.flagged = Boolean(flagged);
    ticket.flaggedAt = ticket.flagged ? new Date() : null;
    await ticket.save();

    emitTicketMeta(ticket);
    return res.json({ success: true });
  } catch (err) {
    console.error("Flag toggle error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- REST: close ticket ----------
app.patch("/api/tickets/:id/close", async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(404)
        .json({ success: false, message: "not found", reason: "bad_id" });
    }

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res
        .status(404)
        .json({ success: false, message: "not found", reason: "missing" });
    }

    if (ticket.status === "fixed") {
      io.emit("ticket:closed", { _id: ticket._id, title: ticket.title });
      await computeAndEmitStats();
      return res
        .status(409)
        .json({ success: true, already: true, _id: ticket._id });
    }

    ticket.status = "fixed";
    ticket.closedAt = new Date();
    await ticket.save();

    io.emit("ticket:closed", { _id: ticket._id, title: ticket.title });
    emitTicketMeta(ticket);
    await computeAndEmitStats();

    return res.json({ success: true, _id: ticket._id });
  } catch (err) {
    console.error("Close ticket error:", err);
    return res.status(500).json({ success: false, message: "server_error" });
  }
});

// ---------- List tickets ----------
app.get("/api/tickets", async (_req, res) => {
  try {
    const tickets = await Ticket.find().sort({ createdAt: -1 });
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (_req, res) => {
  res.send("Server is running ✅");
});

// ---------- Socket.IO connection ----------
io.on("connection", async (socket) => {
  console.log(`🟢 Client connected: ${socket.id}`);
  socket.emit("happiness:update", { happiness });
  await computeAndEmitStats();

  socket.on("join", async (data = {}) => {
    try {
      const { role, ticketId } = data;

      if (role === "staff") {
        socket.join("support");
        console.log(`👥 ${socket.id} joined room: support`);
      }

      if (ticketId && mongoose.Types.ObjectId.isValid(String(ticketId))) {
        const room = `ticket:${String(ticketId)}`;
        socket.join(room);
        socket.emit("joined", { room });
        console.log(`🧵 ${socket.id} joined room: ${room}`);

        // backlog so client never misses AI reply
        const msgs = await ChatMessage.find({
          ticketId: new mongoose.Types.ObjectId(String(ticketId)),
        })
          .sort({ createdAt: 1 })
          .limit(500);

        const normalized = msgs.map((m) => ({
          _id: String(m._id),
          ticketId: String(m.ticketId),
          authorType: m.authorType,
          authorName: m.authorName,
          text: m.text,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
        }));

        socket.emit("chat:history", normalized);
      }
    } catch (e) {
      console.error("join handler error:", e?.message || e);
    }
  });

  socket.on("disconnect", () => {
    console.log(`🔴 Client disconnected: ${socket.id}`);
  });
});

// ---------- Start server ----------
const PORT = process.env.PORT || 4000;
try {
  await connectDB();
  mongoose.connection.on("connected", () => {
    console.log(
      "✅ Mongo connected:",
      mongoose.connection.host,
      mongoose.connection.name
    );
  });
  server.listen(PORT, () => {
    console.log(`🚀 Running on PORT ${PORT}`);
    setInterval(async () => {
      await computeAndEmitStats();
    }, 5000);
  });
} catch (err) {
  console.error("❌ Failed to start:", err);
  process.exit(1);
}
