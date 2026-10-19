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
      const idx = state.events.map((e) => !e.voided).lastIndexOf(true);
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
      s[`${e.shot}_A`] += 1;
      if (e.made) { s[`${e.shot}_M`] += 1; s.PTS += shot.pts; }
      if (e.assistBy && stats[e.assistBy]) stats[e.assistBy].AST += 1;
    } else if (e.type === 'ACTION') {
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
