import { useState } from 'react';
import { AXES, UNITS, unitLabel } from '@baseline/shared';
import { useAuth, useLoad } from '@baseline/ui';

const axisLabel = (section, key) => AXES[section].find((a) => a.key === key)?.label;

export default function Drills() {
  const { api } = useAuth();
  const { data, error, loading, reload } = useLoad('/training/drills');
  const [section, setSection] = useState('physical');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', section: 'physical', unit: 'seconds', custom: '', direction: 'lower', axis: '', description: '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const create = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      await api.request('/training/drills', { method: 'POST', body: { ...form, unit: form.unit === 'other' ? form.custom : form.unit, axis: form.axis || null } });
      setCreating(false);
      setSection(form.section);
      setForm({ ...form, name: '', description: '' });
      reload();
    } catch (x) { setErr(x.message); }
  };

  if (loading && !data) return <p className="muted">Loading…</p>;
  if (error) return <p className="error">{error}</p>;
  const list = data.drills.filter((d) => d.section === section);

  return (
    <div className="stack">
      <div className="row between">
        <div className="seg">
          <button className={section === 'physical' ? 'on' : ''} onClick={() => setSection('physical')}>Physical</button>
          <button className={section === 'skill' ? 'on' : ''} onClick={() => setSection('skill')}>Skill</button>
        </div>
        {!creating && <button className="btn btn-primary btn-sm" onClick={() => { setForm({ ...form, section }); setCreating(true); }}>New drill</button>}
      </div>

      {creating && (
        <form className="card stack-s" onSubmit={create}>
          <h3>New drill</h3>
          <div className="form-grid">
            <label className="field">Name<input value={form.name} onChange={set('name')} required /></label>
            <label className="field">Section
              <select value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value, axis: '' })}>
                <option value="physical">Physical</option><option value="skill">Skill</option>
              </select>
            </label>
            <label className="field">Measured in
              <select value={form.unit} onChange={set('unit')}>{UNITS.map((u) => <option key={u.key} value={u.key}>{u.label}</option>)}<option value="other">Other (type it)</option></select>
            </label>
            {form.unit === 'other' && <label className="field">Unit name<input value={form.custom} onChange={set('custom')} placeholder="e.g. laps" required /></label>}
            <label className="field">Better is
              <select value={form.direction} onChange={set('direction')}><option value="higher">Higher (more reps, longer jump)</option><option value="lower">Lower (faster time)</option></select>
            </label>
            <label className="field">Shows on the chart as
              <select value={form.axis} onChange={set('axis')}><option value="">Not on the chart</option>{AXES[form.section].map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}</select>
            </label>
          </div>
          <label className="field">Notes (optional)<input value={form.description} onChange={set('description')} /></label>
          {err && <p className="error">{err}</p>}
          <div className="row">
            <button className="btn btn-primary btn-sm">Save drill</button>
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => setCreating(false)}>Cancel</button>
          </div>
        </form>
      )}

      <ul className="list">
        {list.map((d) => (
          <li key={d.id}>
            <span className="grow"><strong>{d.name}</strong><br /><span className="muted">{unitLabel(d.unit)}, {d.direction === 'lower' ? 'lower is better' : 'higher is better'}{d.axis ? `, chart axis: ${axisLabel(d.section, d.axis)}` : ''}</span></span>
            {d.is_starter && <span className="badge">starter</span>}
          </li>
        ))}
      </ul>
      <p className="muted">Starter drills are shared. Starting levels and targets are set per team when you record results.</p>
    </div>
  );
}
