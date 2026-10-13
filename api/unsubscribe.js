import { remove, exists } from './_lib/store.js';
import { send, body, clean, hash, limited, unsubOk, EMAIL_RE } from './_lib/http.js';

// POST {email, t} -> removes the subscriber when the signed link is valid.
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
  if (limited(req, 'unsub', 10)) return send(res, 429, { error: 'too_many_requests' });
  const b = body(req);
  const email = clean(b.email, 200).toLowerCase();
  if (!EMAIL_RE.test(email) || !unsubOk(email, b.t)) return send(res, 400, { error: 'invalid_link' });
  try {
    const path = 'subscribers/' + hash(email) + '.json';
    if (await exists('subscribers/' + hash(email))) await remove(path);
    return send(res, 200, { ok: true });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'storage_error' });
  }
}
