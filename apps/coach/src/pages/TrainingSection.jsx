import { Hexagon, useLoad } from '@baseline/ui';

// A player's training charts, recorded in the Baseline Trainer app. Shown to staff, and to linked players and parents.
export default function TrainingSection({ playerId }) {
  const { data } = useLoad(`/training/players/${playerId}`);
  if (!data) return null;
  const any = [...data.hexagons.physical, ...data.hexagons.skill].some((a) => a.now != null);
  if (!any && !data.canEdit) return null;
  return (
    <section className="stack-s">
      <h3>Training</h3>
      {any ? (
        <div className="pair">
          <Hexagon title="Physical" axes={data.hexagons.physical} />
          <Hexagon title="Skill" axes={data.hexagons.skill} />
        </div>
      ) : <p className="muted">No training results yet. Record them in the Baseline Trainer app.</p>}
    </section>
  );
}
