import 'express-async-errors';
import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import { teams } from './teams.js';
import { matches } from './matches.js';
import { publicApi } from './public.js';
import { players } from './players.js';
import { training } from './training.js';
import { hashPassword, checkPassword, sign, requireAuth } from './auth.js';
import { seedDemo } from './seed.js';

const app = express();
app.use(express.json());

const ROLES = ['staff', 'viewer'];
const fail = (res, status, error) => res.status(status).json({ error });

app.get('/api/health', async (_req, res) => { await db.get('SELECT 1 AS ok'); res.json({ ok: true }); });

app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password, role } = req.body ?? {};
  const cleanName = String(name ?? '').trim();
  const cleanEmail = String(email ?? '').trim().toLowerCase();
  if (!cleanName) return fail(res, 400, 'Please enter your name');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) return fail(res, 400, 'Please enter a valid email');
  if (String(password ?? '').length < 8) return fail(res, 400, 'Password must be at least 8 characters');
  if (!ROLES.includes(role)) return fail(res, 400, 'Choose how you will use Baseline');
  if (await db.get('SELECT 1 AS x FROM users WHERE email = ?', cleanEmail)) return fail(res, 409, 'An account with this email already exists');

  const user = await db.get('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?) RETURNING id, name, email, role',
    cleanName, cleanEmail, hashPassword(password), role);
  res.status(201).json({ token: sign(user), user });
});

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const row = await db.get('SELECT * FROM users WHERE email = ?', email);
  if (!row || !checkPassword(String(req.body?.password ?? ''), row.password_hash)) return fail(res, 401, 'Email or password is incorrect');
  const user = { id: row.id, name: row.name, email: row.email, role: row.role };
  res.json({ token: sign(user), user });
});

app.get('/api/me', requireAuth, (req, res) => res.json({ user: req.user }));

app.use('/api/teams', teams);
app.use('/api/matches', matches);
app.use('/api/public', publicApi);
app.use('/api/players', players);
app.use('/api/training', training);
app.use('/api', (_req, res) => fail(res, 404, 'Not found'));

// In production the server also serves the built apps, so one address does everything:
// the Coach app at / and the Trainer app at /trainer/.
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'apps');
const dist = path.join(root, 'coach', 'dist');
const trainerDist = path.join(root, 'trainer', 'dist');
const noCache = (res, file) => { if (file.endsWith('sw.js') || file.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache'); };
if (existsSync(trainerDist)) {
  app.use('/trainer', express.static(trainerDist, { setHeaders: noCache }));
  app.get(/^\/trainer(\/.*)?$/, (_req, res) => res.sendFile(path.join(trainerDist, 'index.html')));
}
if (existsSync(dist)) {
  app.use(express.static(dist, { setHeaders: noCache }));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, _req, res, _next) => {
  if (err.code === '22P02') return fail(res, 400, 'Bad request');
  if (err.code === '23505') return fail(res, 409, 'That already exists');
  console.error(err);
  fail(res, 500, 'Something went wrong on the server');
});

// Locally the demo accounts are created on start. On a host, set SEED_DEMO=true once if you want them.
if (process.env.SEED_DEMO === 'true' || (!process.env.DATABASE_URL && process.env.SEED_DEMO !== 'false')) await seedDemo();

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => console.log(`Baseline server running on http://localhost:${PORT}`));
