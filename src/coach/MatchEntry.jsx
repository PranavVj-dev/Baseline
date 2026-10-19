import { useEffect, useReducer, useRef, useState } from 'react';
import {
  SHOTS, ACTIONS, reducer, initialState, newId, liveEvents,
  quarterOf, onCourtIds, derive, describe,
} from '../shared/match.js';
import { TEAM_NAME } from '../shared/roster.js';

const KEY = 'baseline-match-v2';
const load = () => {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.events) return s; } catch { /* ignore */ }
  return initialState();
};

// Shows the number, and when it changes a +2 / +3 rises from below and drops into it.
function Score({ label, value }) {
  const prev = useRef(value);
  const [pops, setPops] = useState([]);
  useEffect(() => {
    const diff = value - prev.current;
    prev.current = value;
    if (!diff) return;
    const id = newId();
    setPops((p) => [...p, { id, diff }]);
    setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 1000);
  }, [value]);
  return (
    <div className={`score${pops.length ? ' hot' : ''}`}>
      <span className="who">{label}</span>
      <span className="digits">{value}</span>
      {pops.map((p) => (
        <span key={p.id} className={`pop${p.diff < 0 ? ' neg' : ''}`}>{p.diff > 0 ? '+' : '−'}{Math.abs(p.diff)}</span>
      ))}
    </div>
  );
}

function Starters({ roster, onStart }) {
  const [sel, setSel] = useState([]);
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < 5 ? [...s, id] : s));
  return (
    <div className="overlay">
      <div className="sheet">
        <div className="sheet-head"><strong>Pick the starting five</strong><span>{sel.length} of 5</span></div>
        <div className="names">
          {roster.map((p) => <button key={p.id} className={sel.includes(p.id) ? 'on' : ''} onClick={() => toggle(p.id)}>{p.name}</button>)}
        </div>
        <button className="primary" disabled={sel.length !== 5} onClick={() => onStart(sel)}>Start match</button>
      </div>
    </div>
  );
}

function BreakTable({ state, quarter, onClose }) {
  const [scope, setScope] = useState('quarter');
  const { stats } = derive(state, scope === 'quarter' ? quarter : undefined);
  const fg = (s) => `${s['2PT_M'] + s.LAYUP_M + s['3PT_M']}/${s['2PT_A'] + s.LAYUP_A + s['3PT_A']}`;
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
                    <td>{p.name}</td><td>{s.PTS}</td><td>{fg(s)}</td>
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

  if (!state.ready) return <Starters roster={state.roster} onStart={(sel) => dispatch({ type: 'SET_STARTERS', ids: sel })} />;

  const flash = (text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };
  const log = (event) => { const id = newId(); dispatch({ type: 'LOG', event: { ...event, id } }); return id; };
  const closeAssist = () => { clearTimeout(assistTimer.current); setAssist(null); };
  const choose = (id) => { closeAssist(); setPicked(picked === id ? null : id); };

  const logShot = (shot, made) => {
    const id = log({ type: 'SHOT', playerId: picked, shot, made });
    closeAssist();
    if (made && shot !== 'FT') {
      setAssist({ eventId: id, scorer: picked });
      assistTimer.current = setTimeout(() => setAssist(null), 5000);
    }
    setPicked(null);
  };
  const logAction = (action) => { log({ type: 'ACTION', playerId: picked, action }); closeAssist(); setPicked(null); };

  const undo = () => {
    const ev = liveEvents(state.events).at(-1);
    if (!ev) return;
    dispatch({ type: 'UNDO' });
    closeAssist();
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
    <>
      <div className="rotate">Turn your phone sideways to log a match.</div>
      <main className="match">
        <aside className="left">
          <div className="board">
            <div className="qtr">Q{q}</div>
            <Score label={TEAM_NAME} value={home} />
            <Score label="Opponent" value={opp} />
          </div>
          <div className="opprow">
            <span>Opponent</span>
            {[1, 2, 3].map((n) => <button key={n} onClick={() => log({ type: 'OPP', pts: n })}>+{n}</button>)}
          </div>
          <div className="ctrl">
            <button onClick={undo} disabled={!liveEvents(state.events).length}>Undo</button>
            <button onClick={redo} disabled={!state.redo.length}>Redo</button>
            <button onClick={() => setSubOut(null)}>Sub</button>
            <button onClick={endQuarter}>End Q{q}</button>
          </div>
          <button className="link" onClick={() => { if (confirm('Clear this match and start a new one?')) { dispatch({ type: 'RESET' }); setPicked(null); closeAssist(); } }}>New match</button>
        </aside>

        <section className="players">
          {court.map((p) => {
            const s = stats[p.id];
            return (
              <button key={p.id} className={`player${picked === p.id ? ' sel' : ''}`} onClick={() => choose(p.id)}>
                <span className="pname">{p.name}</span>
                <span className="mini">{s.PTS} pts, {s.PF} fouls</span>
              </button>
            );
          })}
        </section>

        <section className="pad">
          <div className="hint">{picked ? `Logging for ${byId(picked).name}` : 'Tap a player'}</div>
          {SHOTS.map((s) => (
            <div className="shotrow" key={s.key}>
              <span>{s.label}</span>
              <button className="made" disabled={!picked} onClick={() => logShot(s.key, true)}>Made</button>
              <button className="missed" disabled={!picked} onClick={() => logShot(s.key, false)}>Missed</button>
            </div>
          ))}
          <div className="acts">
            {ACTIONS.map((a) => <button key={a.key} disabled={!picked} onClick={() => logAction(a.key)}>{a.label}</button>)}
          </div>
          {assist && (
            <div className="assist" key={assist.eventId}>
              <div className="ask">Assist on {byId(assist.scorer).name}'s basket?</div>
              <div className="who4">
                {court.filter((p) => p.id !== assist.scorer).map((p) => (
                  <button key={p.id} onClick={() => { dispatch({ type: 'ASSIST', eventId: assist.eventId, by: p.id }); closeAssist(); }}>{p.name}</button>
                ))}
              </div>
              <button className="none" onClick={closeAssist}>No assist</button>
              <i className="timer" />
            </div>
          )}
        </section>

        {subOut !== undefined && (
          <div className="overlay" onClick={() => setSubOut(undefined)}>
            <div className="sheet" onClick={(e) => e.stopPropagation()}>
              <div className="sheet-head"><strong>{subOut === null ? 'Who comes off?' : 'Who comes on?'}</strong><button className="link" onClick={() => setSubOut(undefined)}>Cancel</button></div>
              <div className="names">
                {(subOut === null ? court : bench).map((p) => (
                  <button key={p.id} onClick={() => (subOut === null ? setSubOut(p.id) : doSub(p.id))}>{p.name}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {breakQ && <BreakTable state={state} quarter={breakQ} onClose={() => setBreakQ(null)} />}

        {toast && (
          <div className="toast">
            <span>{toast}</span>
            {state.redo.length > 0 && <button onClick={redo}>Redo</button>}
          </div>
        )}
      </main>
    </>
  );
}
