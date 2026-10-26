// Everything about a match is derived from one append-only event log.
// Score, stats, quarter and on-court players are all computed from it,
// so undo/redo is just voiding or restoring events.

export const SHOTS = [
  { key: '2PT', label: '2PT', pts: 2 },
  { key: 'LAYUP', label: 'Lay-up', pts: 2 },
  { key: '3PT', label: '3PT', pts: 3 },
  { key: 'FT', label: 'Free throw', pts: 1 },
];

// Labels follow the paper stat sheets coaches already use.
export const ACTIONS = [
  { key: 'O_REB', label: 'Off rebound' },
  { key: 'D_REB', label: 'Def rebound' },
  { key: 'STEAL', label: 'Steal' },
  { key: 'BLOCK', label: 'Block' },
  { key: 'MISS_PASS', label: 'Missed pass' },
  { key: 'O_FOUL', label: 'Off foul' },
  { key: 'D_FOUL', label: 'Def foul' },
];


export const newId = () => Math.random().toString(36).slice(2, 9);

export const initialState = (roster = []) => ({
  roster,
  starters: roster.slice(0, 5).map((p) => p.id),
  events: [],
  redo: [],
  ready: false, // true once the starting five is picked
});

export const liveEvents = (events) => events.filter((e) => !e.voided);
export const quarterOf = (events) => 1 + liveEvents(events).filter((e) => e.type === 'END_Q').length;

export function reducer(state, action) {
  switch (action.type) {
    case 'LOG': {
      const e = { ts: Date.now(), voided: false, ...action.event, quarter: quarterOf(state.events) };
      return { ...state, events: [...state.events, e], redo: [] }; // a new action clears redo
    }
    case 'ASSIST': // stored on the basket itself, so one undo reverses both
      return { ...state, events: state.events.map((e) => (e.id === action.eventId ? { ...e, assistBy: action.by } : e)) };
    case 'UNDO': {
      const idx = state.events.map((e) => !e.voided && !e.type.startsWith('CLOCK')).lastIndexOf(true); // undo skips clock taps
      if (idx < 0) return state;
      const target = state.events[idx];
      return {
        ...state,
        events: state.events.map((e, i) => (i === idx ? { ...e, voided: true } : e)),
        redo: [...state.redo, target.id],
      };
    }
    case 'REDO': {
      const id = state.redo.at(-1);
      if (!id) return state;
      return {
        ...state,
        events: state.events.map((e) => (e.id === id ? { ...e, voided: false } : e)),
        redo: state.redo.slice(0, -1),
      };
    }
    case 'SET_STARTERS':
      return { ...state, starters: action.ids, ready: true };
    case 'RESET':
      return initialState(state.roster);
    default:
      return state;
  }
}

export function onCourtIds(state) {
  let ids = [...state.starters];
  liveEvents(state.events).forEach((e) => {
    if (e.type === 'SUB') ids = ids.map((id) => (id === e.out ? e.in : id));
  });
  return ids;
}

const blank = () => {
  const s = { PTS: 0, PF: 0, REB: 0, STEAL: 0, BLOCK: 0, MISS_PASS: 0, AST: 0 };
  SHOTS.forEach((x) => { s[`${x.key}_M`] = 0; s[`${x.key}_A`] = 0; });
  return s;
};

// quarter is optional: pass a number for one quarter, omit for the whole game
export function derive(state, quarter) {
  const stats = Object.fromEntries(state.roster.map((p) => [p.id, blank()]));
  let opp = 0;
  liveEvents(state.events).forEach((e) => {
    if (quarter && e.quarter !== quarter) return;
    const s = stats[e.playerId];
    if (e.type === 'SHOT') {
      const shot = SHOTS.find((x) => x.key === e.shot);
      if (s) {
        s[`${e.shot}_A`] += 1;
        if (e.made) { s[`${e.shot}_M`] += 1; s.PTS += shot.pts; }
      }
      if (e.assistBy && stats[e.assistBy]) stats[e.assistBy].AST += 1;
    } else if (e.type === 'ACTION' && s) {
      if (e.action === 'O_REB' || e.action === 'D_REB') s.REB += 1;
      else if (e.action === 'O_FOUL' || e.action === 'D_FOUL') s.PF += 1;
      else s[e.action] += 1;
    } else if (e.type === 'OPP') {
      opp += e.pts;
    }
  });
  return { stats, opp };
}

export function describe(e, roster) {
  const p = (id) => {
    const r = roster.find((x) => x.id === id);
    return r ? r.name : '';
  };
  switch (e.type) {
    case 'SHOT': return `${p(e.playerId)} ${e.shot} ${e.made ? 'made' : 'missed'}`;
    case 'ACTION': return `${p(e.playerId)} ${ACTIONS.find((a) => a.key === e.action).label.toLowerCase()}`;
    case 'SUB': return `${p(e.in)} in for ${p(e.out)}`;
    case 'END_Q': return `end of Q${e.quarter}`;
    case 'OPP': return `opponent +${e.pts}`;
    default: return e.type;
  }
}

// Score from an event list (used by the server and the apps so they always agree).
export function scoreFromEvents(events) {
  let home = 0;
  let opp = 0;
  liveEvents(events).forEach((e) => {
    if (e.type === 'SHOT' && e.made) home += SHOTS.find((s) => s.key === e.shot)?.pts ?? 0;
    else if (e.type === 'OPP') opp += e.pts;
  });
  return { home, opp };
}

// Latest event that Undo would reverse (clock taps are not undone; just tap the clock again).
export const lastUndoable = (events) => liveEvents(events).filter((e) => !e.type.startsWith('CLOCK')).at(-1);

export const fmtClock = (sec) => {
  const s = Math.max(0, Math.floor(sec || 0));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

// Playing time from the event log. Time only counts while the clock is running, and each
// running second goes to the five players on court at that moment. Ending a quarter pauses the clock.
// Pass `now` to include the time since the last event while a match is live. Pass `onlyQuarter` for one quarter.
export function playingTime(state, now = null, onlyQuarter = null) {
  const seconds = Object.fromEntries(state.roster.map((p) => [p.id, 0]));
  const quarters = {};
  let court = [...state.starters];
  let running = false;
  let last = null;
  let q = 1;
  const advance = (ts) => {
    if (running && last != null) {
      const d = Math.max(0, ts - last) / 1000;
      quarters[q] = (quarters[q] || 0) + d;
      if (!onlyQuarter || q === onlyQuarter) court.forEach((id) => { if (id in seconds) seconds[id] += d; });
    }
    last = ts;
  };
  liveEvents(state.events).forEach((e) => {
    advance(e.ts);
    if (e.type === 'CLOCK_START') running = true;
    else if (e.type === 'CLOCK_PAUSE') running = false;
    else if (e.type === 'END_Q') { running = false; q += 1; }
    else if (e.type === 'SUB') court = court.map((id) => (id === e.out ? e.in : id));
  });
  if (now != null) advance(now);
  return { seconds, quarters, running, quarter: q };
}
