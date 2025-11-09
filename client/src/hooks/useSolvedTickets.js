// src/hooks/useSolvedTickets.js
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

export default function useSolvedTickets({ limit = 20 } = {}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const socketRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/tickets/solved?limit=${limit}`);
      const j = await r.json().catch(() => ({}));
      setItems(j?.items || []);
    } catch (e) {
      console.error("load solved failed", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [limit]);

  useEffect(() => {
    const s = io({ transports: ["websocket"] });
    socketRef.current = s;

    const refresh = () => load();
    s.on("ticket:closed", refresh);
    s.on("ticket:updated", refresh);

    return () => {
      s.off("ticket:closed", refresh);
      s.off("ticket:updated", refresh);
      s.disconnect();
      socketRef.current = null;
    };
  }, []);

  return { items, loading, reload: load };
}
