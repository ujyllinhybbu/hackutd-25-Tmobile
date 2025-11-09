// models/Ticket.js
import mongoose from "mongoose";

const TicketSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    city: { type: String, default: "Unknown" },

    severity: {
      type: String,
      enum: ["minor", "major", "critical"],
      default: "minor",
    },
    status: {
      type: String,
      enum: ["open", "fixed"],
      default: "open",
    },

    createdBy: { type: String, default: "Guest" },

    // denormalized chat meta
    messageCount: { type: Number, default: 0 },
    lastMessageSnippet: { type: String, default: "" },
    lastMessageAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },

    // ---- AI analysis fields ----
    flagged: { type: Boolean, default: false },
    flaggedAt: { type: Date, default: null },
    sentiment: {
      type: String,
      enum: ["neutral", "upset", "happy", "confused"],
      default: "neutral",
    },
    keywords: { type: [String], default: [] },
    analyzedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Helpful indexes for dashboards/filters
TicketSchema.index({ status: 1, severity: 1, updatedAt: -1 });
TicketSchema.index({ flagged: 1, updatedAt: -1 });
TicketSchema.index({ keywords: 1 });

const Ticket = mongoose.model("Ticket", TicketSchema);
export default Ticket;
