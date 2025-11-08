import express from "express";
import dotenv from "dotenv";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { connectDB } from "./db/connectToDB.js";
import Ticket from "./models/Ticket.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static("public")); // serves /public/test.html

// --- HTTP + WebSocket setup ---
const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: "*" } });

// --- Compute stats (JSON snapshot) ---
async function computeStats() {
  const total = await Ticket.countDocuments();
  const open = await Ticket.countDocuments({ status: { $ne: "fixed" } });
  const fixed = await Ticket.countDocuments({ status: "fixed" });
  const flagged = await Ticket.countDocuments({ flagged: true });

  const bySeverity = await Ticket.aggregate([
    { $group: { _id: "$severity", count: { $sum: 1 } } },
  ]);
  const severityCounts = { minor: 0, major: 0, critical: 0 };
  for (const row of bySeverity) severityCounts[row._id] = row.count;

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
  };
}

// --- Emit stats over WS ---
async function computeAndEmitStats() {
  try {
    const payload = await computeStats();
    io.emit("live:stats", payload);
  } catch (err) {
    console.error("Error computing stats:", err.message);
  }
}

// --- REST routes ---
app.post("/api/test-ticket", async (req, res) => {
  try {
    const {
      title = "Test ticket",
      city = "Dallas",
      severity = "minor",
      status = "open", // optional if your model has default
    } = req.body || {};

    const ticket = await Ticket.create({ title, city, severity, status });
    res.json({ success: true, ticket });

    io.emit("ticket:created", ticket);
    await computeAndEmitStats();
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/tickets", async (_req, res) => {
  try {
    const tickets = await Ticket.find().sort({ createdAt: -1 });
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/stats", async (_req, res) => {
  try {
    const payload = await computeStats();
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (_req, res) => {
  res.send("Server is running ✅");
});

// --- WebSocket connections ---
io.on("connection", async (socket) => {
  console.log(`🟢 Client connected: ${socket.id}`);
  await computeAndEmitStats();

  socket.on("disconnect", () => {
    console.log(`🔴 Client disconnected: ${socket.id}`);
  });
});

// --- Start server ---
const PORT = process.env.PORT || 4000;
server.listen(PORT, async () => {
  await connectDB();
  console.log(`🚀 Running on PORT ${PORT}`);
  setInterval(async () => {
    await computeAndEmitStats();
  }, 5000);
});
