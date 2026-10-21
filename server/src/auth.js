import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { db } from './db.js';

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

export function requireAuth(req, res, next) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m) return res.status(401).json({ error: 'Not signed in' });
  try {
    const { sub } = jwt.verify(m[1], SECRET);
    const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(sub);
    if (!user) return res.status(401).json({ error: 'Account not found' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
}

export const requireRole = (role) => (req, res, next) =>
  req.user.role === role ? next() : res.status(403).json({ error: 'Not available for your account type' });

// For public pages: signed-in callers are recognised, everyone else carries on as a guest.
export function optionalAuth(req, _res, next) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (m) {
    try {
      const { sub } = jwt.verify(m[1], SECRET);
      req.user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(sub) ?? null;
    } catch { req.user = null; }
  }
  next();
}
