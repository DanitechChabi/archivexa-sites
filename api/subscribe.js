import { writeJSON, exists } from './_lib/store.js';
import { send, body, clean, hash, limited, notify, EMAIL_RE } from './_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
  if (limited(req, 'sub', 8)) return send(res, 429, { error: 'too_many_requests' });
  const b = body(req);
  if (b.website) return send(res, 200, { ok: true }); // honeypot
  const email = clean(b.email, 200).toLowerCase();
  if (!EMAIL_RE.test(email)) return send(res, 400, { error: 'invalid_email' });
  const source = clean(b.source || 'site', 40);
  const id = hash(email);
  try {
    if (await exists('subscribers/' + id)) return send(res, 200, { ok: true, already: true });
    await writeJSON('subscribers/' + id + '.json', { email, source, at: new Date().toISOString() });
    await notify('Nouvel abonné Archivexa', `${email} (source : ${source})`);
    return send(res, 200, { ok: true });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'storage_error' });
  }
}
