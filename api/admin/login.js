import { send, body, limited, makeToken, passwordOk } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
  if (limited(req, 'login', 5)) return send(res, 429, { error: 'too_many_requests' });
  if (!process.env.ADMIN_PASSWORD || !process.env.ADMIN_SECRET) return send(res, 503, { error: 'not_configured' });
  if (!passwordOk(body(req).password || '')) return send(res, 401, { error: 'bad_password' });
  return send(res, 200, { token: makeToken() });
}
