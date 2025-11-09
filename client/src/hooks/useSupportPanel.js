import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";

const DEFAULT_FILTERS = {
  status: "all", // all | open | fixed
  severity: "all", // all | minor | major | critical
  q: "", // search text in title/city/snippet
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
  const [messages, setMessages] = useState({}); // { [ticketId]: [msg,msg,...] }
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  // status
  const [loading, setLoading] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState(null);

  // socket
  const socketRef = useRef(null);

  // ---- helpers
  const setTicketMessages = useCallback((ticketId, updater) => {
    setMessages((prev) => {
      const current = prev[ticketId] || [];
      const next = typeof updater === "function" ? updater(current) : updater;
      return { ...prev, [ticketId]: next };
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
      // Initialize message arrays to avoid undefined
      const m = {};
      for (const t of data) if (!m[t._id]) m[t._id] = [];
      setMessages((prev) => ({ ...m, ...prev }));
      // auto-select first if nothing selected
      if (!selectedId && data.length) setSelectedId(String(data[0]._id));
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, [apiBase, selectedId]);

  // ---- fetch ticket message history (if backend supports it)
  const fetchHistory = useCallback(
    async (ticketId) => {
      setLoadingThread(true);
      try {
        // If your backend doesn’t have this yet, return silently.
        // Implement GET /api/tickets/:id/messages to return [{_id, ticketId, authorType, authorName, text, createdAt}, ...]
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
            m.authorName || (m.authorType === "staff" ? "Agent" : m.authorType),
          text: m.text || "",
          ts: new Date(m.createdAt || Date.now()).getTime(),
        }));
        setTicketMessages(ticketId, normalized);
      } catch (_e) {
        // No-op if 404; leave empty. You can log if you want:
        // console.warn("No history endpoint, showing live only.");
      } finally {
        setLoadingThread(false);
      }
    },
    [apiBase, setTicketMessages]
  );

  // ---- select ticket
  const selectTicket = useCallback(
    async (ticketId) => {
      setSelectedId(ticketId);
      // join the room for this ticket to receive room-scoped messages
      if (socketRef.current && ticketId) {
        socketRef.current.emit("join", { ticketId });
      }
      // try to fetch history (if available)
      fetchHistory(ticketId);
    },
    [fetchHistory]
  );

  // ---- send staff message
  const sendMessage = useCallback(
    async (ticketId, text) => {
      if (!ticketId || !text?.trim()) return { ok: false };
      try {
        const payload = {
          authorType: "staff",
          authorName: staffName,
          text,
        };
        const res = await axios.post(
          `${apiBase}/tickets/${ticketId}/chat`,
          payload
        );
        // optimistic add in case socket delays
        const now = Date.now();
        setTicketMessages(ticketId, (curr) => [
          ...curr,
          {
            id: res.data?.message?._id || crypto.randomUUID(),
            role: "staff",
            author: staffName,
            text,
            ts: now,
          },
        ]);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e?.response?.data?.message || e.message };
      }
    },
    [apiBase, staffName, setTicketMessages]
  );

  // ---- close ticket
  const closeTicket = useCallback(
    async (ticketId) => {
      if (!ticketId) return { ok: false, status: 400 };
      try {
        const res = await axios.patch(`${apiBase}/tickets/${ticketId}/close`);
        // refresh counters quickly
        fetchTickets();
        return { ok: true, status: res.status, data: res.data };
      } catch (e) {
        const status = e?.response?.status || 500;
        return { ok: false, status, error: e?.response?.data || e.message };
      }
    },
    [apiBase, fetchTickets]
  );

  // ---- socket setup
  useEffect(() => {
    const socket = io(socketOrigin || undefined, { transports: ["websocket"] });
    socketRef.current = socket;

    // Join support room (broadcast stream)
    if (joinSupportRoom) {
      socket.emit("join", { role: "staff" });
    }

    socket.on("connect", () => {
      // console.log("Support socket connected", socket.id);
    });

    // Incoming chat messages (global or room)
    socket.on("chat:new", (payload) => {
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
    });

    // Ticket meta updates (message counts/snippets) — optional
    socket.on("ticket:meta", (meta) => {
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
              }
            : t
        )
      );
    });

    // New ticket created
    socket.on("ticket:created", (ticket) => {
      setTickets((prev) => [ticket, ...prev]);
      if (!messages[String(ticket._id)]) {
        setMessages((prev) => ({ ...prev, [String(ticket._id)]: [] }));
      }
    });

    // Cleanup
    return () => {
      socket.disconnect();
    };
  }, [socketOrigin, joinSupportRoom, messages]);

  // First load tickets
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

  const filtered = useMemo(() => {
    const { status, severity, q } = filters;
    const qnorm = q.trim().toLowerCase();
    return tickets.filter((t) => {
      if (status !== "all") {
        const isOpen = t.status !== "fixed";
        if (status === "open" && !isOpen) return false;
        if (status === "fixed" && isOpen) return false;
      }
      if (severity !== "all" && t.severity !== severity) return false;
      if (qnorm) {
        const blob = `${t.title || ""} ${t.city || ""} ${
          t.lastMessageSnippet || ""
        }`.toLowerCase();
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
