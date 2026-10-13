import crypto from 'node:crypto';
import { readJSON, writeJSON } from '../_lib/store.js';
import { send, body, clean, limited } from '../_lib/http.js';
import { getSession, CODE_RE } from './_session.js';

// Attendance certificates.
// POST {code, name} -> issues the certificate when the trainer's attendance sheet shows
//                      at least 80 % presence over the scheduled duration.
// GET  ?id=XXXX      -> public verification (the QR code on the certificate points here).
const ID_RE = /^[A-Z0-9]{12}$/;
const THRESHOLD = 0.8;

function norm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
function certId(code, name) {
  const secret = process.env.ADMIN_SECRET || 'archivexa';
  const h = crypto.createHmac('sha256', secret).update(code + '|' + norm(name)).digest();
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(h.subarray(0, 12), (b) => A[b % A.length]).join('');
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const id = clean(req.query?.id, 20).toUpperCase();
      if (!ID_RE.test(id)) return send(res, 400, { error: 'invalid_id' });
      const cert = await readJSON('live/certificates/' + id + '.json');
      return cert ? send(res, 200, { valid: true, certificate: cert }) : send(res, 404, { valid: false, error: 'not_found' });
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
    if (limited(req, 'cert', 10)) return send(res, 429, { error: 'too_many_requests' });
    const b = body(req);
    const code = clean(b.code, 20).toUpperCase();
    const name = clean(b.name, 60);
    if (!CODE_RE.test(code) || name.length < 2) return send(res, 400, { error: 'invalid_request' });
    const session = await getSession(code);
    if (!session) return send(res, 404, { error: 'session_not_found' });
    const sheet = await readJSON('live/attendance/' + code + '.json');
    if (!sheet) return send(res, 409, { error: 'pending' });
    const row = (sheet.rows || []).find((r) => norm(r.nom) === norm(name) && r.role !== 'Formateur');
    if (!row) return send(res, 404, { error: 'not_in_sheet' });
    const required = Math.ceil((session.duration || 60) * THRESHOLD);
    if ((row.minutes || 0) < required) return send(res, 403, { error: 'insufficient', minutes: row.minutes || 0, required });
    const id = certId(code, name);
    const path = 'live/certificates/' + id + '.json';
    let cert = await readJSON(path);
    if (!cert) {
      cert = {
        id,
        name: row.nom,
        code,
        title: session.title,
        formation: session.formation,
        date: session.date,
        duration: session.duration,
        minutes: row.minutes,
        trainer: session.trainer,
        issuedAt: new Date().toISOString(),
      };
      await writeJSON(path, cert);
    }
    return send(res, 200, { certificate: cert });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'server_error' });
  }
}
