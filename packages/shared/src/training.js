// Training drills: hexagon axes, units, and how a result becomes a 0 to 100 score.
export const AXES = {
  physical: [
    { key: 'speed', label: 'Speed' }, { key: 'agility', label: 'Agility' }, { key: 'endurance', label: 'Endurance' },
    { key: 'power', label: 'Power' }, { key: 'strength', label: 'Strength' }, { key: 'flexibility', label: 'Flexibility' },
  ],
  skill: [
    { key: 'shooting', label: 'Shooting' }, { key: 'finishing', label: 'Finishing' }, { key: 'handling', label: 'Ball handling' },
    { key: 'passing', label: 'Passing' }, { key: 'defence', label: 'Defence' }, { key: 'awareness', label: 'Game sense' },
  ],
};

export const UNITS = [
  { key: 'seconds', label: 'seconds' }, { key: 'cm', label: 'cm' }, { key: 'm', label: 'metres' }, { key: 'reps', label: 'reps' },
  { key: 'kg', label: 'kg' }, { key: 'makes', label: 'makes' }, { key: 'rating', label: 'rating (1 to 5)' }, { key: 'level', label: 'level' },
];

export const unitLabel = (u) => UNITS.find((x) => x.key === u)?.label ?? u;

// 0 at the starting level (baseline), 100 at the target, capped.
// Works when higher is better (target above baseline) and when lower is better (target below baseline).
export function scoreOf(value, baseline, target) {
  if (baseline === target) return value === target ? 100 : 0;
  const s = ((value - baseline) / (target - baseline)) * 100;
  return Math.max(0, Math.min(100, Math.round(s)));
}
