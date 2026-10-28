import crypto from 'node:crypto';
import { writeJSON } from './_lib/store.js';
import { send, body, clean, limited, notify, EMAIL_RE } from './_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
  if (limited(req, 'req', 6)) return send(res, 429, { error: 'too_many_requests' });
  const b = body(req);
  if (b.website) return send(res, 200, { ok: true }); // honeypot
  const kind = b.kind === 'formation' ? 'formation' : 'rdv';
  const item = {
    kind,
    session: clean(b.session, 80),
    needs: Array.isArray(b.needs) ? b.needs.slice(0, 10).map((n) => clean(n, 60)) : [],
    sector: clean(b.sector, 60),
    vol: Number.isFinite(+b.vol) ? Math.max(0, Math.min(100000, +b.vol)) : 0,
    name: clean(b.name, 120),
    org: clean(b.org, 160),
    email: clean(b.email, 200).toLowerCase(),
    msg: clean(b.msg, 3000),
    no: clean(b.no, 40),
    people: Number.isFinite(+b.people) ? Math.max(0, Math.min(1000, Math.round(+b.people))) : 0,
    format: clean(b.format, 60),
    at: new Date().toISOString(),
  };
  if (!item.name || !EMAIL_RE.test(item.email)) return send(res, 400, { error: 'invalid_request' });
  try {
    const id = Date.now() + '-' + crypto.randomBytes(4).toString('hex');
    await writeJSON('requests/' + id + '.json', item);
    const isFm = kind === 'formation';
    await notify(
      (isFm ? 'Nouvelle demande de formation : ' : 'Nouvelle demande de rendez-vous : ') + item.name,
      [
        isFm ? `Format : ${item.format || '-'}` : `Séance : ${item.session}`,
        `Nom : ${item.name}`,
        `Organisation : ${item.org || '-'}`,
        `E-mail : ${item.email}`,
        isFm ? `Modules : ${item.needs.join(', ') || 'à définir'}` : `Besoin : ${item.needs.join(', ') || '-'}`,
        isFm ? `Participants : ${item.people}` : `Secteur : ${item.sector || '-'}`,
        isFm ? '' : `Volume : ${item.vol} ml`,
        item.no ? `Référence : ${item.no}` : '',
        item.msg ? `Message : ${item.msg}` : '',
      ].filter(Boolean).join('\n')
    );
    return send(res, 200, { ok: true });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'storage_error' });
  }
}
