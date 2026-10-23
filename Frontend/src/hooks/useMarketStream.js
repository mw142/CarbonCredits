import { useEffect, useRef, useState } from 'react';

/**
 * Subscribe to the live market feed (Server-Sent Events at /api/market/stream).
 * Falls back to polling /api/market/snapshot every 30 s if the stream cannot be opened.
 */
export default function useMarketStream() {
  const [snapshot, setSnapshot] = useState(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    let closed = false;
    let source;

    const accept = (data) => {
      if (closed) return;
      setSnapshot(data);
      setUpdatedAt(new Date());
      setError('');
    };

    const poll = async () => {
      try {
        const res = await fetch('/api/market/snapshot');
        if (!res.ok) throw new Error(`Market data unavailable (${res.status})`);
        accept(await res.json());
      } catch (err) {
        if (!closed) setError(err.message);
      }
    };

    const startPolling = () => {
      if (pollRef.current) return;
      poll();
      pollRef.current = setInterval(poll, 30_000);
    };

    if (typeof EventSource !== 'undefined') {
      source = new EventSource('/api/market/stream');
      source.addEventListener('snapshot', (event) => {
        try { accept(JSON.parse(event.data)); setLive(true); } catch { /* ignore malformed */ }
      });
      source.onopen = () => setLive(true);
      source.onerror = () => {
        setLive(false);
        // EventSource retries on its own; poll meanwhile so the page still updates.
        startPolling();
      };
    } else {
      startPolling();
    }

    return () => {
      closed = true;
      source?.close();
      clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (live && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [live]);

  return { snapshot, live, error, updatedAt };
}
