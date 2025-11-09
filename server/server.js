import express from "express";
import dotenv from "dotenv";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import mongoose from "mongoose";
import { connectDB } from "./db/connectToDB.js";
import Ticket from "./models/Ticket.js";
import ChatMessage from "./models/ChatMessage.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static("public")); // serves /public/*.html

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

// --- REST: create real ticket (used by chat.html “Start Chat”) ---
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

    // ✨ Persist a bot welcome message so it shows for both user & staff
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

    // Broadcast bot message (user might not have joined yet; they'll get it via history)
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

// --- REST: append chat message (stores + broadcasts to room and staff) ---
app.post("/api/tickets/:id/chat", async (req, res) => {
  try {
    const { id } = req.params;
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

    res.json({ success: true, message: payload });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ success: false, error: err.message });
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

// --- REST: list chat messages for a ticket ---
app.get("/api/tickets/:id/chat", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid ticket id" });
    }
    const msgs = await ChatMessage.find({ ticketId: id }).sort({
      createdAt: 1,
    });
    res.json({ success: true, messages: msgs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- REST: close ticket (validated + atomic) ---
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

app.patch("/api/tickets/:id/close", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id))
      return res
        .status(400)
        .json({ success: false, message: "Invalid ticket id" });

    const now = new Date();
    const updated = await Ticket.findOneAndUpdate(
      { _id: id, status: { $ne: "fixed" } },
      { $set: { status: "fixed", updatedAt: now, resolvedAt: now } },
      { new: true, runValidators: true }
    );

    if (!updated) {
      const exists = await Ticket.exists({ _id: id });
      if (!exists)
        return res
          .status(404)
          .json({ success: false, message: "Ticket not found" });
      return res
        .status(409)
        .json({ success: false, message: "Ticket already fixed" });
    }

    if (!updated.timeSpentMs) {
      updated.timeSpentMs = updated.resolvedAt - updated.createdAt;
      await updated.save();
    }

    happiness = Math.min(100, happiness + 3);
    io.emit("ticket:closed", updated);
    io.emit("happiness:update", { happiness });
    await computeAndEmitStats();

    res.json({ success: true, ticket: updated });
  } catch (err) {
    console.error("Error closing ticket:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- REST: generic status update with allowed transitions ---
const ALLOWED_TRANSITIONS = {
  open: ["investigating", "escalated", "fixed"],
  investigating: ["escalated", "fixed"],
  escalated: ["fixed"],
  fixed: [],
};

app.patch("/api/tickets/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    if (!isValidId(id))
      return res
        .status(400)
        .json({ success: false, message: "Invalid ticket id" });
    if (!status)
      return res
        .status(400)
        .json({ success: false, message: "Missing 'status' in body" });

    const ticket = await Ticket.findById(id);
    if (!ticket)
      return res
        .status(404)
        .json({ success: false, message: "Ticket not found" });

    const allowed = ALLOWED_TRANSITIONS[ticket.status] || [];
    if (!allowed.includes(status)) {
      return res.status(409).json({
        success: false,
        message: `Invalid transition from '${ticket.status}' to '${status}'`,
      });
    }

    ticket.status = status;
    ticket.updatedAt = new Date();
    if (status === "fixed") {
      ticket.resolvedAt = new Date();
      ticket.timeSpentMs = ticket.resolvedAt - ticket.createdAt;
    }
    await ticket.save();

    if (status === "fixed") {
      happiness = Math.min(100, happiness + 3);
      io.emit("happiness:update", { happiness });
      io.emit("ticket:closed", ticket);
    } else {
      io.emit("ticket:updated", { id: String(ticket._id), status });
    }

    await computeAndEmitStats();
    res.json({ success: true, ticket });
  } catch (err) {
    console.error("Error updating status:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Snapshot of stats (including happiness) ---
app.get("/api/stats", async (_req, res) => {
  try {
    const payload = await computeStats();
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Happiness helpers (optional) ---
app.get("/api/happiness", (_req, res) => res.json({ happiness }));
app.post("/api/happiness/reset", (_req, res) => {
  happiness = 100;
  io.emit("happiness:update", { happiness });
  res.json({ happiness });
});

// --- Root ---
app.get("/", (_req, res) => res.send("Server is running ✅"));

// --- WebSocket connections ---
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
// Connect DB first to avoid race conditions, then listen
const PORT = process.env.PORT || 4000;
try {
  await connectDB();
  console.log("✅ Mongo connected");
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
