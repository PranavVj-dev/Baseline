import express from 'express';
import { db } from './db.js';
import { teams } from './teams.js';
import { hashPassword, checkPassword, sign, requireAuth } from './auth.js';

const app = express();
app.use(express.json());

const ROLES = ['staff', 'viewer'];
const fail = (res, status, error) => res.status(status).json({ error });
const publicUser = (id) => db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(id);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post('/api/auth/signup', (req, res) => {
  const { name, email, password, role } = req.body ?? {};
  const cleanName = String(name ?? '').trim();
  const cleanEmail = String(email ?? '').trim().toLowerCase();
  if (!cleanName) return fail(res, 400, 'Please enter your name');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) return fail(res, 400, 'Please enter a valid email');
  if (String(password ?? '').length < 8) return fail(res, 400, 'Password must be at least 8 characters');
  if (!ROLES.includes(role)) return fail(res, 400, 'Choose how you will use Baseline');
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(cleanEmail)) return fail(res, 409, 'An account with this email already exists');

  const info = db
    .prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(cleanName, cleanEmail, hashPassword(password), role);
  const user = publicUser(info.lastInsertRowid);
  res.status(201).json({ token: sign(user), user });
});

app.post('/api/auth/login', (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!row || !checkPassword(String(req.body?.password ?? ''), row.password_hash)) {
    return fail(res, 401, 'Email or password is incorrect');
  }
  const user = publicUser(row.id);
  res.json({ token: sign(user), user });
});

app.get('/api/me', requireAuth, (req, res) => res.json({ user: req.user }));

app.use('/api/teams', teams);

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => console.log(`Baseline server running on http://localhost:${PORT}`));
