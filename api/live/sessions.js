import { send } from '../_lib/http.js';
import { allSessions, getSession, publicSession, liveConfigured } from './_session.js';

// GET /api/live/sessions            -> upcoming sessions (public)
// GET /api/live/sessions?code=XXX   -> one session (public fields only)
export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' });
  if (!liveConfigured()) return send(res, 503, { error: 'live_not_configured' });
  try {
    const code = String(req.query?.code || '').toUpperCase();
    if (code) {
      const s = await getSession(code);
      return s ? send(res, 200, { session: publicSession(s) }) : send(res, 404, { error: 'not_found' });
    }
    const now = Date.now();
    const sessions = (await allSessions())
      .filter((s) => new Date(s.date).getTime() + (s.duration || 60) * 60000 > now && s.listed !== false)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .map(publicSession);
    return send(res, 200, { sessions });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'storage_error' });
  }
}
