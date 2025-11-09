import { useEffect, useRef, useState } from "react";
import axios from "axios";

const STORAGE_KEY = "tmobile_chat_messages_v1";

/**
 * Custom hook for managing chatbot conversation state
 * Features:
 * - Persistent chat (localStorage)
 * - Simulated or live responses (REST / WebSocket)
 * - Typing indicator
 * - Auto-scroll trigger (for Chatbot.jsx)
 */
export default function useChatbot(options = {}) {
  const { simulate = true, apiBase = "/api" } = options;

  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isTyping, setIsTyping] = useState(false);
  const scrollTrigger = useRef(0); // increment to trigger auto-scroll

  /** Save messages to localStorage */
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  /** Add new message */
  const addMessage = (role, text) => {
    const msg = { id: crypto.randomUUID(), role, text, ts: Date.now() };
    setMessages((prev) => [...prev, msg]);
    scrollTrigger.current++;
  };

  /** Send message (user -> bot) */
  const sendMessage = async (text) => {
    if (!text?.trim()) return;
    addMessage("user", text);
    setIsTyping(true);

    try {
      let reply = "Sorry, no response yet.";

      if (simulate) {
        // --- Simulated typing ---
        const canned = [
          "Thanks for reaching out! Let me check that for you.",
          "I'm reviewing your account and connection details.",
          "Let’s fix this together. One moment please...",
          "I’ll escalate this to our technical team and update you shortly.",
        ];
        await new Promise((r) => setTimeout(r, 900 + Math.random() * 1000));
        reply = canned[Math.floor(Math.random() * canned.length)];
      } else {
        // --- Real API call ---
        const res = await axios.post(`${apiBase}/chat`, { text });
        reply = res.data?.reply || res.data?.message || "Response received.";
      }

      addMessage("bot", reply);
    } catch (err) {
      console.error("Chat error:", err.message);
      addMessage("bot", "⚠️ Network error. Please try again.");
    } finally {
      setIsTyping(false);
    }
  };

  /** Clear conversation */
  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return {
    messages,
    isTyping,
    sendMessage,
    clearChat,
    addMessage,
    scrollTrigger, // can be used to scroll to bottom when this changes
  };
}
