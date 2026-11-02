import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { db } from './db.js';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) throw new Error('Set the JWT_SECRET environment variable');
const SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function checkPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(password, Buffer.from(salt, 'hex'), 64);
  return crypto.timingSafeEqual(test, Buffer.from(hash, 'hex'));
}

export const sign = (user) => jwt.sign({ sub: user.id }, SECRET, { expiresIn: '7d' });

const userFromHeader = async (header) => {
  const m = /^Bearer (.+)$/.exec(header || '');
  if (!m) return { missing: true };
  let sub;
  try { ({ sub } = jwt.verify(m[1], SECRET)); } catch { return { bad: true }; }
  const user = await db.get('SELECT id, name, email, role FROM users WHERE id = ?', sub);
  return user ? { user } : { bad: true };
};

export async function requireAuth(req, res, next) {
  const r = await userFromHeader(req.headers.authorization);
  if (r.missing) return res.status(401).json({ error: 'Not signed in' });
  if (r.bad) return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  req.user = r.user;
  next();
}

export const requireRole = (role) => (req, res, next) =>
  req.user.role === role ? next() : res.status(403).json({ error: 'Not available for your account type' });

// For public pages: signed-in callers are recognised, everyone else carries on as a guest.
export async function optionalAuth(req, _res, next) {
  const r = await userFromHeader(req.headers.authorization);
  if (r.user) req.user = r.user;
  next();
}
