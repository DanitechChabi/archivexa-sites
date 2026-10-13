import { writeJSON, remove, listJSON } from '../_lib/store.js';
import { send, body, clean, isAdmin } from '../_lib/http.js';
import { newCode, getSession, allSessions, CODE_RE } from './_session.js';

const FORMATIONS = ['FOR-01', 'FOR-02', 'FOR-03', 'FOR-04', 'FOR-05', 'FOR-06', 'AUTRE'];

// Admin only.
// GET    -> all sessions + attendance sheets
// PUT    {code?, title, formation, date, duration, trainer, listed} -> create or update
// DELETE ?code=XXX
export default async function handler(req, res) {
  if (!isAdmin(req)) return send(res, 401, { error: 'unauthorized' });
  try {
    if (req.method === 'GET') {
      const [sessions, sheets] = await Promise.all([allSessions(), listJSON('live/attendance/')]);
      sessions.sort((a, b) => String(b.date).localeCompare(String(a.date)));
      return send(res, 200, { sessions, attendance: sheets.map((x) => x.data).sort((a, b) => String(b.at).localeCompare(String(a.at))) });
    }
    if (req.method === 'PUT') {
      const b = body(req);
      let code = clean(b.code, 20).toUpperCase();
      const existing = code ? await getSession(code) : null;
      if (code && !existing) return send(res, 404, { error: 'not_found' });
      if (!code) code = newCode();
      const date = new Date(b.date);
      if (isNaN(date.getTime())) return send(res, 400, { error: 'invalid_date' });
      const s = {
        code,
        title: clean(b.title, 160),
        formation: FORMATIONS.includes(b.formation) ? b.formation : 'AUTRE',
        date: date.toISOString(),
        duration: Math.max(15, Math.min(480, parseInt(b.duration, 10) || 60)),
        trainer: clean(b.trainer, 80) || 'Archivexa',
        modules: Array.isArray(b.modules) ? b.modules.slice(0, 20).map((m) => clean(m, 120)).filter(Boolean) : [],
        listed: b.listed !== false,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (!s.title) return send(res, 400, { error: 'missing_title' });
      await writeJSON('live/sessions/' + code + '.json', s);
      return send(res, 200, { ok: true, session: s });
    }
    if (req.method === 'DELETE') {
      const code = clean(req.query?.code, 20).toUpperCase();
      if (!CODE_RE.test(code)) return send(res, 400, { error: 'invalid_code' });
      await remove('live/sessions/' + code + '.json');
      return send(res, 200, { ok: true });
    }
    return send(res, 405, { error: 'method_not_allowed' });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'storage_error' });
  }
}
