import { writeJSON, readJSON } from '../_lib/store.js';
import { send, body, clean, isAdmin } from '../_lib/http.js';
import { CODE_RE } from './_session.js';

// POST {code, rows:[{nom, role, arrivee, depart, minutes}]} -> saves the attendance sheet (admin only).
// One file per session. Rows are merged with the saved sheet (longest presence kept), so a trainer
// who reconnects never lowers anyone's recorded presence.
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
  if (!isAdmin(req)) return send(res, 401, { error: 'unauthorized' });
  const b = body(req);
  const code = clean(b.code, 20).toUpperCase();
  if (!CODE_RE.test(code)) return send(res, 400, { error: 'invalid_code' });
  const rows = (Array.isArray(b.rows) ? b.rows : []).slice(0, 500).map((r) => ({
    nom: clean(r.nom, 80),
    role: clean(r.role, 20),
    arrivee: clean(r.arrivee, 40),
    depart: clean(r.depart, 40),
    minutes: Math.max(0, Math.min(1440, parseInt(r.minutes, 10) || 0)),
  }));
  try {
    const key = (r) => String(r.nom).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() + '|' + r.role;
    const prev = (await readJSON('live/attendance/' + code + '.json')) || { rows: [] };
    const merged = new Map((prev.rows || []).map((r) => [key(r), r]));
    rows.forEach((r) => {
      const old = merged.get(key(r));
      if (!old) merged.set(key(r), r);
      else merged.set(key(r), { ...r, arrivee: old.arrivee || r.arrivee, minutes: Math.max(old.minutes || 0, r.minutes) });
    });
    await writeJSON('live/attendance/' + code + '.json', { code, rows: [...merged.values()], at: new Date().toISOString() });
    return send(res, 200, { ok: true });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'storage_error' });
  }
}
