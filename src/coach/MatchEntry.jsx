import { useEffect, useReducer, useRef, useState } from 'react';
import {
  SHOTS, ACTIONS, reducer, initialState, newId, liveEvents,
  quarterOf, onCourtIds, derive, describe,
} from '../shared/match.js';

const KEY = 'baseline-match-v1';
const load = () => {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.events) return s; } catch { /* ignore */ }
  return initialState();
};

function BreakTable({ state, quarter, onClose }) {
  const [scope, setScope] = useState('quarter');
  const { stats } = derive(state, scope === 'quarter' ? quarter : undefined);
  const fg = (s) => {
    const m = s['2PT_M'] + s.LAYUP_M + s['3PT_M'];
    const a = s['2PT_A'] + s.LAYUP_A + s['3PT_A'];
    return `${m}/${a}`;
  };
  return (
    <div className="overlay">
      <div className="sheet wide">
        <div className="sheet-head">
          <strong>End of Q{quarter}</strong>
          <div className="seg">
            <button className={scope === 'quarter' ? 'on' : ''} onClick={() => setScope('quarter')}>This quarter</button>
            <button className={scope === 'game' ? 'on' : ''} onClick={() => setScope('game')}>Game so far</button>
          </div>
        </div>
        <div className="scroll">
          <table>
            <thead><tr><th>Player</th><th>PTS</th><th>FG</th><th>3P</th><th>FT</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>PF</th></tr></thead>
            <tbody>
              {state.roster.map((p) => {
                const s = stats[p.id];
                return (
                  <tr key={p.id}>
                    <td>#{p.no} {p.name}</td><td>{s.PTS}</td><td>{fg(s)}</td>
                    <td>{s['3PT_M']}/{s['3PT_A']}</td><td>{s.FT_M}/{s.FT_A}</td>
                    <td>{s.REB}</td><td>{s.AST}</td><td>{s.STEAL}</td><td>{s.BLOCK}</td><td>{s.PF}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button className="primary" onClick={onClose}>Start Q{quarter + 1}</button>
      </div>
    </div>
  );
}

export default function MatchEntry() {
  const [state, dispatch] = useReducer(reducer, null, load);
  const [picked, setPicked] = useState(null);
  const [assist, setAssist] = useState(null);
  const [toast, setToast] = useState(null);
  const [subOut, setSubOut] = useState(undefined); // undefined = closed, null = choosing who leaves
  const [breakQ, setBreakQ] = useState(null);
  const assistTimer = useRef();
  const toastTimer = useRef();

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(state)); }, [state]);

  const ids = onCourtIds(state);
  const court = ids.map((id) => state.roster.find((p) => p.id === id));
  const bench = state.roster.filter((p) => !ids.includes(p.id));
  const { stats, opp } = derive(state);
  const home = Object.values(stats).reduce((a, s) => a + s.PTS, 0);
  const q = quarterOf(state.events);
  const byId = (id) => state.roster.find((p) => p.id === id);

  const flash = (text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };
  const log = (event) => { const id = newId(); dispatch({ type: 'LOG', event: { ...event, id } }); return id; };

  const logShot = (shot, made) => {
    const id = log({ type: 'SHOT', playerId: picked, shot, made });
    clearTimeout(assistTimer.current);
    if (made && shot !== 'FT') {
      setAssist({ eventId: id, scorer: picked });
      assistTimer.current = setTimeout(() => setAssist(null), 5000);
    } else setAssist(null);
    setPicked(null);
  };
  const logAction = (action) => { log({ type: 'ACTION', playerId: picked, action }); setAssist(null); setPicked(null); };

  const undo = () => {
    const ev = liveEvents(state.events).at(-1);
    if (!ev) return;
    dispatch({ type: 'UNDO' });
    setAssist(null);
    flash(`Undone: ${describe(ev, state.roster)}`);
  };
  const redo = () => {
    const ev = state.events.find((e) => e.id === state.redo.at(-1));
    if (!ev) return;
    dispatch({ type: 'REDO' });
    flash(`Redone: ${describe(ev, state.roster)}`);
  };
  const endQuarter = () => { log({ type: 'END_Q' }); setBreakQ(q); };
  const doSub = (inId) => { log({ type: 'SUB', out: subOut, in: inId }); setSubOut(undefined); };

  return (
    <main className="match">
      <header className="board">
        <div className="side"><span className="who">Home</span><span className="num">{home}</span></div>
        <div className="mid"><span className="qtr">Q{q}</span></div>
        <div className="side"><span className="who">Opponent</span><span className="num">{opp}</span></div>
      </header>

      <div className="bar">
        <button onClick={undo} disabled={!liveEvents(state.events).length}>Undo</button>
        <button onClick={redo} disabled={!state.redo.length}>Redo</button>
        <button onClick={() => setSubOut(null)}>Sub</button>
        <button onClick={endQuarter}>End Q{q}</button>
      </div>

      <section className="players">
        {court.map((p) => {
          const s = stats[p.id];
          return (
            <button key={p.id} className="player" onClick={() => setPicked(p.id)}>
              <span className="jersey">{p.no}</span>
              <span className="pname">{p.name}</span>
              <span className="mini">{s.PTS} pts, {s.PF} fouls</span>
            </button>
          );
        })}
      </section>

      <section className="opp">
        <span>Opponent score</span>
        {[1, 2, 3].map((n) => <button key={n} onClick={() => { log({ type: 'OPP', pts: n }); }}>+{n}</button>)}
      </section>

      <footer className="foot">
        <button className="link" onClick={() => { if (confirm('Clear this match and start a new one?')) dispatch({ type: 'RESET' }); }}>New match</button>
      </footer>

      {picked && (
        <div className="overlay" onClick={() => setPicked(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head"><strong>#{byId(picked).no} {byId(picked).name}</strong><button className="link" onClick={() => setPicked(null)}>Close</button></div>
            {SHOTS.map((s) => (
              <div className="shotrow" key={s.key}>
                <span>{s.label}</span>
                <button className="made" onClick={() => logShot(s.key, true)}>Made</button>
                <button className="missed" onClick={() => logShot(s.key, false)}>Missed</button>
              </div>
            ))}
            <div className="grid">
              {ACTIONS.map((a) => <button key={a.key} onClick={() => logAction(a.key)}>{a.label}</button>)}
            </div>
          </div>
        </div>
      )}

      {subOut !== undefined && (
        <div className="overlay" onClick={() => setSubOut(undefined)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head"><strong>{subOut === null ? 'Who comes off?' : 'Who comes on?'}</strong><button className="link" onClick={() => setSubOut(undefined)}>Cancel</button></div>
            <div className="grid">
              {(subOut === null ? court : bench).map((p) => (
                <button key={p.id} onClick={() => (subOut === null ? setSubOut(p.id) : doSub(p.id))}>#{p.no} {p.name}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {breakQ && <BreakTable state={state} quarter={breakQ} onClose={() => setBreakQ(null)} />}

      {assist && (
        <div className="assist">
          <span>Assist by?</span>
          {court.filter((p) => p.id !== assist.scorer).map((p) => (
            <button key={p.id} onClick={() => { dispatch({ type: 'ASSIST', eventId: assist.eventId, by: p.id }); setAssist(null); }}>#{p.no}</button>
          ))}
          <button className="none" onClick={() => setAssist(null)}>None</button>
        </div>
      )}

      {toast && (
        <div className="toast">
          <span>{toast}</span>
          {state.redo.length > 0 && <button onClick={redo}>Redo</button>}
        </div>
      )}
    </main>
  );
}
