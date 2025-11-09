// server/models/Ticket.js
import mongoose from "mongoose";

const sentimentScore = (s) => {
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
};

const TicketSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    description: { type: String, trim: true },
    city: { type: String, trim: true },
    severity: {
      type: String,
      enum: ["minor", "major", "critical"],
      default: "minor",
      index: true,
    },
    status: {
      type: String,
      enum: ["open", "fixed"],
      default: "open",
      index: true,
    },
    createdBy: { type: String, trim: true },

    // denorm for dashboards
    lastMessageSnippet: { type: String, default: "" },
    lastMessageAt: { type: Date, index: true },
    messageCount: { type: Number, default: 0 },
    flagged: { type: Boolean, default: false, index: true },

    // close info
    closedAt: { type: Date, index: true },

    // ✅ AI fields
    aiSummary: { type: String, default: "" },
    aiSentiment: {
      type: String,
      enum: ["neutral", "upset", "happy", "confused"],
      default: "neutral",
      index: true,
    },
    aiKeywords: {
      type: [String],
      default: [],
      set: (arr) =>
        Array.from(
          new Set(
            (arr || [])
              .map((s) =>
                String(s || "")
                  .trim()
                  .toLowerCase()
              )
              .filter(Boolean)
          )
        ),
      index: true, // multikey for keyword filters
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// ⚡ common query patterns
TicketSchema.index({ status: 1, closedAt: -1 });
TicketSchema.index({ status: 1, updatedAt: -1 });
TicketSchema.index({ aiSentiment: 1, closedAt: -1 });
TicketSchema.index({ city: 1, closedAt: -1 });
// Optional text search:
// TicketSchema.index({ title: "text", description: "text", aiSummary: "text" });

// Virtual score
TicketSchema.virtual("aiScore").get(function () {
  return sentimentScore(this.aiSentiment);
});
TicketSchema.statics.sentimentScore = sentimentScore;

export default mongoose.models.Ticket || mongoose.model("Ticket", TicketSchema);
