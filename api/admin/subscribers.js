import { remove } from '../_lib/store.js';
import { send, clean, hash, isAdmin, EMAIL_RE } from '../_lib/http.js';

// DELETE ?email=... -> removes a subscriber (admin only).
export default async function handler(req, res) {
  if (!isAdmin(req)) return send(res, 401, { error: 'unauthorized' });
  if (req.method !== 'DELETE') return send(res, 405, { error: 'method_not_allowed' });
  const email = clean(req.query?.email, 200).toLowerCase();
  if (!EMAIL_RE.test(email)) return send(res, 400, { error: 'invalid_email' });
  try {
    await remove('subscribers/' + hash(email) + '.json');
    return send(res, 200, { ok: true });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'storage_error' });
  }
}
