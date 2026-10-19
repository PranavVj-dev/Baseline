import { useCallback, useEffect, useRef, useState } from 'react';

// Every change is saved to the server through a queue kept in the browser.
// If the connection drops, taps still work and are sent when it returns.
const read = (key) => { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } };

export const queueKey = (matchId) => `baseline-queue-${matchId}`;

// Re-applies anything not yet saved on top of what the server sent (after a page refresh).
export function applyQueue(events, queue) {
  const out = events.map((e) => ({ ...e }));
  queue.forEach((op) => {
    if (op.k === 'event' && !out.some((e) => e.id === op.body.id)) out.push({ ...op.body, voided: false });
    const t = out.find((e) => e.id === (op.id ?? op.body?.id));
    if (op.k === 'void' && t) t.voided = op.voided;
    if (op.k === 'assist' && t) t.assistBy = op.by ?? undefined;
  });
  return out;
}

export function useSync(matchId, api) {
  const key = queueKey(matchId);
  const q = useRef(read(key));
  const busy = useRef(false);
  const [st, setSt] = useState({ pending: q.current.length, offline: false, error: '' });

  const save = () => {
    localStorage.setItem(key, JSON.stringify(q.current));
    setSt((s) => ({ ...s, pending: q.current.length }));
  };

  const flush = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    while (q.current.length) {
      const op = q.current[0];
      const base = `/matches/${matchId}/events`;
      try {
        if (op.k === 'event') await api.request(base, { method: 'POST', body: op.body });
        else if (op.k === 'void') await api.request(`${base}/${op.id}/void`, { method: 'POST', body: { voided: op.voided } });
        else await api.request(`${base}/${op.id}/assist`, { method: 'POST', body: { by: op.by } });
        q.current.shift();
        setSt((s) => ({ ...s, offline: false }));
      } catch (e) {
        if (e.status) { q.current.shift(); setSt((s) => ({ ...s, error: e.message })); } // server refused it: drop it
        else { setSt((s) => ({ ...s, offline: true })); break; }                         // no connection: keep and retry
      }
    }
    save();
    busy.current = false;
  }, [api, matchId]);

  useEffect(() => {
    flush();
    const t = setInterval(flush, 3000);
    return () => clearInterval(t);
  }, [flush]);

  const enqueue = (op) => { q.current.push(op); save(); flush(); };
  return { ...st, enqueue };
}
