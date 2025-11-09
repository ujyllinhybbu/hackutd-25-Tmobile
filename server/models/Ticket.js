// models/Ticket.js
import mongoose from "mongoose";

const TicketSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    city: { type: String, default: "Unknown" },

    severity: {
      type: String,
      enum: ["minor", "major", "critical"],
      default: "minor",
      index: true,
    },

    status: {
      type: String,
      enum: ["open", "investigating", "escalated", "fixed"],
      default: "open",
      index: true,
    },

    flagged: { type: Boolean, default: false },

    // relationships / metadata
    createdBy: { type: String, default: "Guest" }, // requester display name
    assignedTo: { type: String, default: "" }, // agent display name

    // denormalized chat fields for dashboards
    lastMessageSnippet: { type: String, default: "" },
    lastMessageAt: { type: Date },
    messageCount: { type: Number, default: 0 },

    // resolution metrics
    resolvedAt: { type: Date },
    timeSpentMs: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Guard: resolvedAt implies status fixed
TicketSchema.pre("validate", function (next) {
  if (this.resolvedAt && this.status !== "fixed") {
    return next(new Error("resolvedAt can only be set when status is 'fixed'"));
  }
  next();
});

export default mongoose.models.Ticket || mongoose.model("Ticket", TicketSchema);
