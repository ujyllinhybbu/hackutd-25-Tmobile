// src/hooks/useSupportPanel.js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";

const DEFAULT_FILTERS = {
  status: "all", // all | open | fixed
  severity: "all", // all | minor | major | critical | flagged
  q: "",
};

export default function useSupportPanel(options = {}) {
  const {
    apiBase = "/api",
    socketOrigin = "",
    staffName = "Support Agent",
    joinSupportRoom = true,
  } = options;

  // data
  const [tickets, setTickets] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState({}); // { [ticketId]: [msg,...] }
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  // status
  const [loading, setLoading] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState(null);

  // socket
  const socketRef = useRef(null);

  // ---- helpers
  const setTicketMessages = useCallback((ticketId, updater) => {
    const id = String(ticketId);
    setMessages((prev) => {
      const curr = prev[id] || [];
      const next = typeof updater === "function" ? updater(curr) : updater;
      return { ...prev, [id]: next };
    });
  }, []);

  // ---- fetch tickets
  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${apiBase}/tickets`);
      const data = Array.isArray(res.data) ? res.data : [];
      setTickets(data);

      // ensure message arrays
      setMessages((prev) => {
        const base = { ...prev };
        for (const t of data) {
          const id = String(t._id);
          if (!base[id]) base[id] = [];
        }
        return base;
      });

      // auto-select first if none selected
      if (!selectedId && data.length) setSelectedId(String(data[0]._id));
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, [apiBase, selectedId]);

  // ---- fetch history (if available)
  const fetchHistory = useCallback(
    async (ticketId) => {
      setLoadingThread(true);
      try {
        const res = await axios.get(`${apiBase}/tickets/${ticketId}/messages`);
        const arr = Array.isArray(res.data)
          ? res.data
          : res.data?.messages || [];
        const normalized = arr.map((m) => ({
          id: String(m._id || crypto.randomUUID()),
          role:
            m.authorType === "user"
              ? "user"
              : m.authorType === "staff"
              ? "staff"
              : "bot",
          author:
            m.authorName ||
            (m.authorType === "staff" ? "Agent" : m.authorType) ||
            "bot",
          text: m.text || "",
          ts: new Date(m.createdAt || Date.now()).getTime(),
        }));
        setTicketMessages(ticketId, normalized);
      } catch {
        // ok if endpoint not implemented
      } finally {
        setLoadingThread(false);
      }
    },
    [apiBase, setTicketMessages]
  );

  // ---- select ticket (also join its room)
  const selectTicket = useCallback(
    async (ticketId) => {
      const id = String(ticketId);
      setSelectedId(id);
      if (socketRef.current && id) {
        socketRef.current.emit("join", { ticketId: id });
      }
      fetchHistory(id);
    },
    [fetchHistory]
  );

  // ---- send staff message (no optimistic add → avoid duplicates)
  const sendMessage = useCallback(
    async (ticketId, text) => {
      const id = String(ticketId || "");
      if (!id || !text?.trim()) return { ok: false };
      try {
        await axios.post(`${apiBase}/tickets/${id}/chat`, {
          authorType: "staff",
          authorName: staffName,
          text,
        });
        // socket "chat:new" will append the message for us
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e?.response?.data?.message || e.message };
      }
    },
    [apiBase, staffName]
  );

  // ---- close ticket
  const closeTicket = useCallback(
    async (ticketId) => {
      const id = String(ticketId || "");
      if (!id) return { ok: false, status: 400 };
      try {
        const res = await axios.patch(`${apiBase}/tickets/${id}/close`);
        fetchTickets();
        return { ok: true, status: res.status, data: res.data };
      } catch (e) {
        const status = e?.response?.status || 500;
        return { ok: false, status, error: e?.response?.data || e.message };
      }
    },
    [apiBase, fetchTickets]
  );

  // ---- SOCKET SETUP (stable)
  useEffect(() => {
    const socket = io(socketOrigin || undefined, { transports: ["websocket"] });
    socketRef.current = socket;

    if (joinSupportRoom) {
      socket.emit("join", { role: "staff" });
    }

    const handleChatNew = (payload) => {
      const tId = String(payload.ticketId);
      const role =
        payload.authorType === "user"
          ? "user"
          : payload.authorType === "staff"
          ? "staff"
          : "bot";

      const msg = {
        id: String(payload._id || crypto.randomUUID()),
        role,
        author: payload.authorName || payload.authorType || "bot",
        text: payload.text || "",
        ts: new Date(payload.createdAt || Date.now()).getTime(),
      };

      setTicketMessages(tId, (curr) => [...curr, msg]);

      // bump/refresh the ticket row immediately
      setTickets((prev) => {
        const idx = prev.findIndex((t) => String(t._id) === tId);
        if (idx < 0) return prev;
        const updated = [...prev];
        const t = { ...updated[idx] };
        t.lastMessageSnippet = msg.text.slice(0, 120);
        t.lastMessageAt = new Date(msg.ts);
        t.messageCount = (t.messageCount || 0) + 1; // corrected by ticket:meta
        updated.splice(idx, 1);
        return [t, ...updated];
      });
    };

    // 🔴 REAL-TIME META (includes flag fields now)
    const handleTicketMeta = (meta) => {
      const id = String(meta.id);
      setTickets((prev) =>
        prev.map((t) =>
          String(t._id) === id
            ? {
                ...t,
                messageCount: meta.messageCount ?? t.messageCount,
                lastMessageSnippet:
                  meta.lastMessageSnippet ?? t.lastMessageSnippet,
                lastMessageAt: meta.lastMessageAt
                  ? new Date(meta.lastMessageAt)
                  : t.lastMessageAt,
                // NEW: live moderation/AI fields
                flagged:
                  typeof meta.flagged === "boolean" ? meta.flagged : t.flagged,
                flaggedAt: meta.flaggedAt
                  ? new Date(meta.flaggedAt)
                  : t.flaggedAt,
                sentiment: meta.sentiment ?? t.sentiment,
                keywords: Array.isArray(meta.keywords)
                  ? meta.keywords
                  : t.keywords,
              }
            : t
        )
      );
    };

    // Optional: separate event when server flags (for toasts/badges)
    const handleTicketFlagged = ({
      ticketId,
      sentiment,
      keywords,
      flaggedAt,
    }) => {
      const id = String(ticketId);
      setTickets((prev) =>
        prev.map((t) =>
          String(t._id) === id
            ? {
                ...t,
                flagged: true,
                flaggedAt: flaggedAt ? new Date(flaggedAt) : new Date(),
                sentiment: sentiment ?? t.sentiment,
                keywords: Array.isArray(keywords) ? keywords : t.keywords,
              }
            : t
        )
      );
    };

    const handleTicketCreated = (ticket) => {
      setTickets((prev) => [ticket, ...prev]);
      setMessages((prev) => {
        const id = String(ticket._id);
        if (prev[id]) return prev;
        return { ...prev, [id]: [] };
      });
    };

    socket.on("chat:new", handleChatNew);
    socket.on("ticket:meta", handleTicketMeta);
    socket.on("ticket:flagged", handleTicketFlagged);
    socket.on("ticket:created", handleTicketCreated);

    return () => {
      socket.off("chat:new", handleChatNew);
      socket.off("ticket:meta", handleTicketMeta);
      socket.off("ticket:flagged", handleTicketFlagged);
      socket.off("ticket:created", handleTicketCreated);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [socketOrigin, joinSupportRoom, setTicketMessages]);

  // first load
  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // ---- derived
  const openCount = useMemo(
    () => tickets.filter((t) => t.status !== "fixed").length,
    [tickets]
  );
  const fixedCount = useMemo(
    () => tickets.filter((t) => t.status === "fixed").length,
    [tickets]
  );
  const flaggedCount = useMemo(
    () => tickets.filter((t) => !!t.flagged).length,
    [tickets]
  );

  const filtered = useMemo(() => {
    const { status, severity, q } = filters;
    const qnorm = q.trim().toLowerCase();
    return tickets.filter((t) => {
      // status filter
      if (status !== "all") {
        const isOpen = t.status !== "fixed";
        if (status === "open" && !isOpen) return false;
        if (status === "fixed" && isOpen) return false;
      }

      // severity / flagged filter
      if (severity === "flagged") {
        if (!t.flagged) return false;
      } else if (severity !== "all" && t.severity !== severity) {
        return false;
      }

      // text search
      if (qnorm) {
        const blob = `${t.title || ""} ${t.city || ""} ${
          t.lastMessageSnippet || ""
        } ${(t.keywords || []).join(" ")}`.toLowerCase(); // include keywords in search
        if (!blob.includes(qnorm)) return false;
      }
      return true;
    });
  }, [tickets, filters]);

  const currentMessages = useMemo(
    () => messages[selectedId] || [],
    [messages, selectedId]
  );
  const selectedTicket = useMemo(
    () => tickets.find((t) => String(t._id) === String(selectedId)) || null,
    [tickets, selectedId]
  );

  return {
    // state
    tickets,
    filtered,
    selectedId,
    selectedTicket,
    currentMessages,
    openCount,
    fixedCount,
    flaggedCount,
    filters,
    loading,
    loadingThread,
    error,

    // actions
    setFilters,
    selectTicket,
    fetchTickets,
    sendMessage,
    closeTicket,
  };
}
