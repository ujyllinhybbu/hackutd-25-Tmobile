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

dotenv.config();

// OpenAI client (optional - used to generate bot replies). Requires OPENAI_API_KEY in env.
const openaiApiKey = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY;
if (!openaiApiKey) {
  console.warn("OpenAI API key not found. AI replies disabled. Set OPENAI_API_KEY in server/.env or environment.");
}

const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;
console.log(openai ? "OpenAI client initialized" : "OpenAI client not initialized");

const app = express();

// OpenAI client (optional - used to generate bot replies). Requires OPENAI_API_KEY in env.


// ---- Put logger FIRST so all requests are visible
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

app.use(express.json());
app.use(express.static("public")); // serves /public/*.html
app.use("/api", metricsRouter);

// --- HTTP + WebSocket setup ---
const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: "*" } });

// --- Demo Happiness score (in-memory) ---
let happiness = 100; // starts at 100

// --- Helpers ---
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

  // Avg resolution time (fixed)
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

  // Avg active time (open)
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

// --- REST: test ticket (kept for curl/Postman) ---
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

// --- REST: create real ticket (used by chat “Start Chat”) ---
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

    // Persist a bot welcome message so it shows for both user & staff
    const welcomeText =
      "🤖 Chatbot will triage your issue and a specialist will join shortly.";
    const botMsg = await ChatMessage.create({
      ticketId: ticket._id,
      authorType: "bot",
      authorName: "AutoBot",
      text: welcomeText,
    });

    // Update denorm fields for dashboards
    ticket.lastMessageAt = botMsg.createdAt;
    ticket.lastMessageSnippet = welcomeText.slice(0, 120);
    ticket.messageCount = (ticket.messageCount || 0) + 1;
    await ticket.save();

    // Broadcast bot message (normalize)
    const payload = {
      _id: botMsg._id,
      ticketId: String(botMsg.ticketId),
      authorType: botMsg.authorType,
      authorName: botMsg.authorName,
      text: botMsg.text,
      createdAt: botMsg.createdAt,
      updatedAt: botMsg.updatedAt,
    };
    io.to(`ticket:${ticket._id}`).emit("chat:new", payload);
    io.to("support").emit("chat:new", payload);

    // Global meta + stats
    happiness = Math.max(0, happiness - 5);
    io.emit("happiness:update", { happiness });
    io.emit("ticket:created", ticket);
    io.emit("ticket:meta", {
      id: String(ticket._id),
      messageCount: ticket.messageCount,
      lastMessageSnippet: ticket.lastMessageSnippet,
      lastMessageAt: ticket.lastMessageAt,
    });
    await computeAndEmitStats();

    res.json({ success: true, ticket });
  } catch (err) {
    console.error("Create ticket error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- REST: append chat message ---
const activateAgentTickets = new Map();

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
    if (!ticket)
      return res
        .status(404)
        .json({ success: false, message: "Ticket not found" });
    if (!text.trim())
      return res.status(400).json({ success: false, message: "Text required" });

    const message = await ChatMessage.create({
      ticketId: new mongoose.Types.ObjectId(id), // explicit cast
      authorType,
      authorName,
      text,
    });

    // Update denorm fields for dashboards
    ticket.lastMessageAt = message.createdAt;
    ticket.lastMessageSnippet = text.slice(0, 120);
    ticket.messageCount = (ticket.messageCount || 0) + 1;
    await ticket.save();

    // Broadcast (normalize ticketId to string)
    const room = `ticket:${id}`;
    const payload = {
      _id: message._id,
      ticketId: String(message.ticketId),
      authorType: message.authorType,
      authorName: message.authorName,
      text: message.text,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };

    io.to(room).emit("chat:new", payload);
    io.to("support").emit("chat:new", payload);

    // Also push meta so lists can update counts/snippets
    io.emit("ticket:meta", {
      id: String(ticket._id),
      messageCount: ticket.messageCount,
      lastMessageSnippet: ticket.lastMessageSnippet,
      lastMessageAt: ticket.lastMessageAt,
    });

    if (authorType === "agent" || authorType === "staff") {
      activateAgentTickets.set(id, Date.now());
    }

    // Spawn an asynchronous job to generate an AI reply (fire-and-forget).
    // This keeps the user-facing request fast while still producing a bot reply
    // that will be persisted and emitted when ready. Requires OPENAI_API_KEY.
    (async () => {
      try {
        if (!openai) return; // OpenAI not configured
        if (authorType !== "user") return;

        const agentLastActive = activateAgentTickets.get(id);
        if (agentLastActive && Date.now() - agentLastActive < 5 * 60 * 1000) {
          return;
        } 

        // Build a small prompt; can be expanded to include recent history later.
        const systemPrompt =
          "You are a T-Mobile customer support assistant. Only answer questions related to T-Mobile services, accounts, billing, technical support, or store information. If asked about unrelated topics (such as games, entertainment, or anything not about T-Mobile), reply: 'Sorry, I can only assist with T-Mobile related questions.'";"You are a T-Mobile customer support assistant. Only answer questions related to T-Mobile services, accounts, billing, technical support, or store information. If asked about unrelated topics (such as games, entertainment, or anything not about T-Mobile), reply: 'Sorry, I can only assist with T-Mobile related questions.'";

        const aiResp = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: text },
          ],
          max_tokens: 1000,
          temperature: 0.8,
        });

        const botText =
          aiResp?.choices?.[0]?.message?.content?.trim() ||
          (aiResp?.choices?.[0]?.delta?.content ?? null);
        if (!botText) return;

        const botMsg = await ChatMessage.create({
          ticketId: new mongoose.Types.ObjectId(id),
          authorType: "bot",
          authorName: "AutoBot",
          text: botText,
        });

        // Update ticket denorm fields
        ticket.lastMessageAt = botMsg.createdAt;
        ticket.lastMessageSnippet = botMsg.text.slice(0, 120);
        ticket.messageCount = (ticket.messageCount || 0) + 1;
        await ticket.save();

        const botPayload = {
          _id: botMsg._id,
          ticketId: String(botMsg.ticketId),
          authorType: botMsg.authorType,
          authorName: botMsg.authorName,
          text: botMsg.text,
          createdAt: botMsg.createdAt,
          updatedAt: botMsg.updatedAt,
        };

        io.to(`ticket:${id}`).emit("chat:new", botPayload);
        io.to("support").emit("chat:new", botPayload);

        io.emit("ticket:meta", {
          id: String(ticket._id),
          messageCount: ticket.messageCount,
          lastMessageSnippet: ticket.lastMessageSnippet,
          lastMessageAt: ticket.lastMessageAt,
        });
      } catch (e) {
        console.error("OpenAI reply error:", e?.message || e);
      }
    })();

    res.json({ success: true, message: payload });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- REST: ticket message history (NEW) ---
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

// --- REST: close ticket (hardened) ---
app.patch("/api/tickets/:id/close", async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    console.log("Close attempt:", { id, len: id.length });

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
    io.emit("ticket:meta", {
      id: String(ticket._id),
      messageCount: ticket.messageCount,
      lastMessageSnippet: ticket.lastMessageSnippet,
      lastMessageAt: ticket.lastMessageAt,
    });
    await computeAndEmitStats();

    return res.json({ success: true, _id: ticket._id });
  } catch (err) {
    console.error("Close ticket error:", err);
    return res.status(500).json({ success: false, message: "server_error" });
  }
});

// --- REST: list tickets ---
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

// --- WebSocket connection event ---
io.on("connection", async (socket) => {
  console.log(`🟢 Client connected: ${socket.id}`);
  socket.emit("happiness:update", { happiness });
  await computeAndEmitStats();

  socket.on("join", (data = {}) => {
    const { role, ticketId } = data;
    if (role === "staff") {
      socket.join("support");
      console.log(`👥 ${socket.id} joined room: support`);
    }
    if (ticketId) {
      const room = `ticket:${String(ticketId)}`;
      socket.join(room);
      socket.emit("joined", { room });
      console.log(`🧵 ${socket.id} joined room: ${room}`);
    }
  });

  socket.on("disconnect", () =>
    console.log(`🔴 Client disconnected: ${socket.id}`)
  );
});

// --- Start server ---
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
