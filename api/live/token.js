import crypto from 'node:crypto';
import { AccessToken } from 'livekit-server-sdk';
import { send, body, clean, limited, isAdmin } from '../_lib/http.js';
import { getSession, publicSession, liveConfigured } from './_session.js';

// POST /api/live/token {code, name} -> LiveKit access token for this session's room.
// The admin session token (Authorization header) makes the caller the trainer.
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
  if (!liveConfigured()) return send(res, 503, { error: 'live_not_configured' });
  if (limited(req, 'live-token', 20)) return send(res, 429, { error: 'too_many_requests' });
  const b = body(req);
  const code = clean(b.code, 20).toUpperCase();
  const name = clean(b.name, 60);
  if (name.length < 2) return send(res, 400, { error: 'invalid_name' });
  try {
    const s = await getSession(code);
    if (!s) return send(res, 404, { error: 'not_found' });
    const end = new Date(s.date).getTime() + ((s.duration || 60) + 60) * 60000;
    const host = isAdmin(req);
    if (!host && Date.now() > end) return send(res, 410, { error: 'session_over' });

    const role = host ? 'host' : 'participant';
    const identity = (host ? 'host-' : 'p-') + crypto.randomBytes(6).toString('hex');
    const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
      identity,
      name,
      metadata: JSON.stringify({ role }),
      ttl: '6h',
    });
    at.addGrant({
      room: code,
      roomJoin: true,
      canSubscribe: true,
      canPublish: true,
      canPublishData: true,
      roomAdmin: host,
    });
    return send(res, 200, { token: await at.toJwt(), url: process.env.LIVEKIT_URL, role, session: publicSession(s) });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'token_error' });
  }
}
