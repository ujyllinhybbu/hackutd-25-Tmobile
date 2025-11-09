// models/ChatMessage.js
import mongoose from "mongoose";

const ChatMessageSchema = new mongoose.Schema(
  {
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ticket",
      required: true,
      index: true,
    },
    authorType: {
      type: String,
      enum: ["user", "staff", "bot"],
      required: true,
    },
    authorName: { type: String, default: "" },
    text: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export default mongoose.models.ChatMessage ||
  mongoose.model("ChatMessage", ChatMessageSchema);
