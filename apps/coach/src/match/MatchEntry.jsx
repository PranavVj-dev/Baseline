import { useEffect, useReducer, useRef, useState } from 'react';
import { SHOTS, ACTIONS, reducer, newId, liveEvents, quarterOf, onCourtIds, derive, scoreFromEvents, describe } from '@baseline/shared';
import { useAuth, useLoad } from '@baseline/ui';
import { useSync, applyQueue, queueKey } from './useSync.js';
import BoxScore from './BoxScore.jsx';
import './match.css';

// The number rises with a +2 / +3 that drops into it.
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
      {pops.map((p) => <span key={p.id} className={`pop${p.diff < 0 ? ' neg' : ''}`}>{p.diff > 0 ? '+' : '−'}{Math.abs(p.diff)}</span>)}
    </div>
  );
}

function HoldExit({ onExit }) {
  const t = useRef();
  const [on, setOn] = useState(false);
  const stop = () => { clearTimeout(t.current); setOn(false); };
  useEffect(() => stop, []);
  return (
    <button className={`hold${on ? ' holding' : ''}`} onPointerDown={() => { setOn(true); t.current = setTimeout(onExit, 1200); }}
      onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}>Hold to exit</button>
  );
}

function Live({ data, api, onExit }) {
  const { match, roster } = data;
  const sync = useSync(match.id, api);
  const [state, dispatch] = useReducer(reducer, null, () => ({
    roster, starters: match.starters, ready: true, redo: [],
    events: applyQueue(data.events, JSON.parse(localStorage.getItem(queueKey(match.id)) || '[]')),
  }));
  const [picked, setPicked] = useState(null);
  const [assist, setAssist] = useState(null);
  const [toast, setToast] = useState(null);
  const [subOut, setSubOut] = useState(undefined); // undefined = closed, null = choosing who leaves
  const [breakQ, setBreakQ] = useState(null);
  const [lineup, setLineup] = useState(null); // { quarter, sel } while choosing who plays the next quarter
  const [finishing, setFinishing] = useState(false);
  const assistTimer = useRef();
  const toastTimer = useRef();

  const ids = onCourtIds(state);
  const byId = (id) => roster.find((p) => p.id === id);
  const court = ids.map(byId);
  const bench = roster.filter((p) => !ids.includes(p.id));
  const { stats } = derive(state);
  const score = scoreFromEvents(state.events);
  const q = quarterOf(state.events);

  const flash = (text) => { setToast(text); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 4000); };
  const closeAssist = () => { clearTimeout(assistTimer.current); setAssist(null); };
  const log = (event) => {
    const ev = { id: newId(), ts: Date.now(), quarter: quarterOf(state.events), ...event };
    dispatch({ type: 'LOG', event: ev });
    sync.enqueue({ k: 'event', body: ev });
    return ev.id;
  };
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
  const giveAssist = (by) => { dispatch({ type: 'ASSIST', eventId: assist.eventId, by }); sync.enqueue({ k: 'assist', id: assist.eventId, by }); closeAssist(); };

  const undo = () => {
    const ev = liveEvents(state.events).at(-1);
    if (!ev) return;
    dispatch({ type: 'UNDO' });
    sync.enqueue({ k: 'void', id: ev.id, voided: true });
    closeAssist();
    flash(`Undone: ${describe(ev, roster)}`);
  };
  const redo = () => {
    const id = state.redo.at(-1);
    const ev = state.events.find((e) => e.id === id);
    if (!ev) return;
    dispatch({ type: 'REDO' });
    sync.enqueue({ k: 'void', id, voided: false });
    flash(`Redone: ${describe(ev, roster)}`);
  };
  const doSub = (inId) => { log({ type: 'SUB', out: subOut, in: inId }); setSubOut(undefined); };
  const endQuarter = () => { log({ type: 'END_Q' }); setBreakQ(q); };
  // Changes between quarters are turned into ordinary substitutions, so stats and undo work as before.
  const startQuarter = () => {
    const outs = ids.filter((id) => !lineup.sel.includes(id));
    const ins = lineup.sel.filter((id) => !ids.includes(id));
    outs.forEach((out, i) => log({ type: 'SUB', out, in: ins[i] }));
    setLineup(null);
  };
  const pickForQuarter = (id) => setLineup((l) => ({ ...l, sel: l.sel.includes(id) ? l.sel.filter((x) => x !== id) : l.sel.length < 5 ? [...l.sel, id] : l.sel }));

  return (
    <div className="entry">
      <div className="entry-top">
        <span className={`sync${sync.offline || sync.error ? ' bad' : ''}`}>
          {sync.error ? `Not saved: ${sync.error}` : sync.offline ? `Offline, ${sync.pending} waiting to save` : sync.pending ? 'Saving…' : 'All changes saved'}
        </span>
        <button className="btn-sm" onClick={() => setFinishing(true)}>Finish match</button>
        <HoldExit onExit={onExit} />
      </div>

      <div className="board">
        <Score label={match.team_name} value={score.home} />
        <div className="qtr">Q{q}</div>
        <Score label={match.opponent_name} value={score.opp} />
      </div>

      <div className="bar">
        <button onClick={undo} disabled={!liveEvents(state.events).length}>Undo</button>
        <button onClick={redo} disabled={!state.redo.length}>Redo</button>
        <button onClick={() => setSubOut(null)}>Sub</button>
        <button onClick={endQuarter}>End Q{q}</button>
        <span className="opp">Opponent {[1, 2, 3].map((n) => <button key={n} onClick={() => log({ type: 'OPP', pts: n })}>+{n}</button>)}</span>
      </div>

      <section className="players">
        {court.map((p) => (
          <button key={p.id} className={`player${picked === p.id ? ' sel' : ''}`} onClick={() => choose(p.id)}>
            <span className="pname">{p.name}</span>
            <span className="mini">{stats[p.id].PTS} pts, {stats[p.id].PF} fouls</span>
          </button>
        ))}
      </section>

      {picked && (
        <>
          <div className="scrim" onClick={() => setPicked(null)} />
          <div className="panel" role="dialog" aria-label="Actions">
            <div className="panel-head"><strong>{byId(picked).name}</strong><button className="btn-quiet btn-sm" onClick={() => setPicked(null)}>Close</button></div>
            {SHOTS.map((s) => (
              <div className="shotrow" key={s.key}>
                <span>{s.label}</span>
                <button className="made" onClick={() => logShot(s.key, true)}>Made</button>
                <button className="missed" onClick={() => logShot(s.key, false)}>Missed</button>
              </div>
            ))}
            <div className="acts">{ACTIONS.map((a) => <button key={a.key} onClick={() => logAction(a.key)}>{a.label}</button>)}</div>
          </div>
        </>
      )}

      {assist && (
        <div className="assist" key={assist.eventId}>
          <strong>Assist on {byId(assist.scorer).name}'s basket?</strong>
          <div className="names">
            {court.filter((p) => p.id !== assist.scorer).map((p) => <button key={p.id} onClick={() => giveAssist(p.id)}>{p.name}</button>)}
            <button className="none" onClick={closeAssist}>No assist</button>
          </div>
          <i className="timer" />
        </div>
      )}

      {subOut !== undefined && (
        <div className="overlay" onClick={() => setSubOut(undefined)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="row between"><strong>{subOut === null ? 'Who comes off?' : 'Who comes on?'}</strong><button className="btn-quiet btn-sm" onClick={() => setSubOut(undefined)}>Cancel</button></div>
            <div className="picks">
              {(subOut === null ? court : bench).map((p) => <button key={p.id} onClick={() => (subOut === null ? setSubOut(p.id) : doSub(p.id))}>{p.name}</button>)}
            </div>
          </div>
        </div>
      )}

      {breakQ && (
        <div className="overlay">
          <div className="modal wide">
            <strong>End of Q{breakQ}: {match.team_name} {score.home}, {match.opponent_name} {score.opp}</strong>
            <BoxScore roster={roster} events={state.events} quarter={breakQ} />
            <button className="btn btn-primary" onClick={() => { setLineup({ quarter: breakQ + 1, sel: ids }); setBreakQ(null); }}>Next: who plays Q{breakQ + 1}?</button>
          </div>
        </div>
      )}

      {lineup && (
        <div className="overlay">
          <div className="modal">
            <strong>Who plays Q{lineup.quarter}?</strong>
            <span className="muted">The five who were on court are already selected. Tap to change, and pick exactly five.</span>
            <div className="picks">
              {roster.map((p) => <button key={p.id} aria-pressed={lineup.sel.includes(p.id)} onClick={() => pickForQuarter(p.id)}>{p.name}</button>)}
            </div>
            <p className="muted">
              {lineup.sel.length !== 5 ? `${lineup.sel.length} of 5 picked`
                : ids.every((id) => lineup.sel.includes(id)) ? 'No changes: same five as before.'
                : `Off: ${ids.filter((id) => !lineup.sel.includes(id)).map((id) => byId(id).name).join(', ')}. On: ${lineup.sel.filter((id) => !ids.includes(id)).map((id) => byId(id).name).join(', ')}.`}
            </p>
            <button className="btn btn-primary" disabled={lineup.sel.length !== 5} onClick={startQuarter}>Start Q{lineup.quarter}</button>
          </div>
        </div>
      )}

      {finishing && <FinishDialog match={match} tracked={score} api={api} pending={sync.pending} onClose={() => setFinishing(false)} onDone={onExit} />}

      {toast && <div className="toast"><span>{toast}</span>{state.redo.length > 0 && <button onClick={redo}>Redo</button>}</div>}
    </div>
  );
}

function FinishDialog({ match, tracked, api, pending, onClose, onDone }) {
  const [home, setHome] = useState(tracked.home);
  const [opp, setOpp] = useState(tracked.opp);
  const [err, setErr] = useState('');
  const save = async () => {
    try {
      await api.request(`/matches/${match.id}/complete`, { method: 'POST', body: { final_home: Number(home), final_opp: Number(opp) } });
      localStorage.removeItem(queueKey(match.id));
      onDone();
    } catch (e) { setErr(e.message); }
  };
  return (
    <div className="overlay">
      <div className="modal">
        <strong>Finish match</strong>
        <p className="muted">Enter the final score from the official scoresheet. If it differs from your tally, the match is flagged for review.</p>
        <div className="form-grid">
          <label className="field">{match.team_name}<input type="number" min="0" value={home} onChange={(e) => setHome(e.target.value)} /></label>
          <label className="field">{match.opponent_name}<input type="number" min="0" value={opp} onChange={(e) => setOpp(e.target.value)} /></label>
        </div>
        {pending > 0 && <p className="error">{pending} changes are still waiting to save. Wait until it says all changes are saved.</p>}
        {err && <p className="error">{err}</p>}
        <div className="row">
          <button className="btn btn-primary" disabled={pending > 0} onClick={save}>Finish and save</button>
          <button className="btn btn-quiet" onClick={onClose}>Keep playing</button>
        </div>
      </div>
    </div>
  );
}

export default function MatchEntry({ matchId, onExit }) {
  const { api } = useAuth();
  const { data, error, loading } = useLoad(`/matches/${matchId}`);
  if (loading) return <div className="center muted">Loading match…</div>;
  if (error) return <div className="center"><div className="card stack-s"><p className="error">{error}</p><button className="btn" onClick={onExit}>Back</button></div></div>;
  if (data.match.status !== 'live') return <div className="center"><div className="card stack-s"><p>This match is not live.</p><button className="btn" onClick={onExit}>Back</button></div></div>;
  return <Live key={matchId} data={data} api={api} onExit={onExit} />;
}
