import crypto from 'node:crypto';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function send(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).send(JSON.stringify(body));
}

export function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

export function clean(value, max = 500) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

export function hash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 24);
}

// Small in-memory limiter: good enough to slow down bursts on one instance.
const hits = new Map();
export function limited(req, key, max = 10, windowMs = 60_000) {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const k = key + ':' + ip;
  const now = Date.now();
  const arr = (hits.get(k) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(k, arr);
  return arr.length > max;
}

// Admin token: payload.signature, HMAC-SHA256 with ADMIN_SECRET.
function secret() {
  return process.env.ADMIN_SECRET || '';
}
export function makeToken(hours = 12) {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + hours * 3600_000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  return payload + '.' + sig;
}
export function isAdmin(req) {
  if (!secret()) return false;
  const h = String(req.headers.authorization || '');
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now();
  } catch {
    return false;
  }
}
export function passwordOk(input) {
  const pw = process.env.ADMIN_PASSWORD || '';
  if (!pw) return false;
  const a = crypto.createHash('sha256').update(String(input)).digest();
  const b = crypto.createHash('sha256').update(pw).digest();
  return crypto.timingSafeEqual(a, b);
}

// Signed unsubscribe links: /desinscription?e=<email>&t=<signature>
export function unsubToken(email) {
  return crypto.createHmac('sha256', (process.env.ADMIN_SECRET || '') + ':unsub').update(String(email).toLowerCase()).digest('base64url').slice(0, 22);
}
export function unsubOk(email, token) {
  if (!process.env.ADMIN_SECRET) return false;
  const a = Buffer.from(String(token || '')), b = Buffer.from(unsubToken(email));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export function siteOrigin(req) {
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  return proto + '://' + String(req.headers['x-forwarded-host'] || req.headers.host || '');
}

// Optional e-mail notification through Resend (RESEND_API_KEY + CONTACT_EMAIL).
export async function notify(subject, text) {
  const key = process.env.RESEND_API_KEY, to = process.env.CONTACT_EMAIL;
  if (!key || !to) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.RESEND_FROM || 'Archivexa <onboarding@resend.dev>', to: [to], subject, text }),
    });
  } catch {
    /* a failed notification never blocks the visitor */
  }
}
