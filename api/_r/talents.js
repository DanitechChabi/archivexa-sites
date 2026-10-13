import { readJSON, writeJSON, writeFile, remove } from './_lib/store.js';
import { send, body, clean, hash, limited, notify, talentToken, talentOk, siteOrigin, sendMails, escHtml, EMAIL_RE } from './_lib/http.js';
import { normalizeTalent, talentValid } from './_lib/jobs.js';

const MAX_CV = 3 * 1024 * 1024;
const TYPES = {
  pdf: { mime: 'application/pdf', ok: (b) => b.subarray(0, 4).toString() === '%PDF' },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ok: (b) => b[0] === 0x50 && b[1] === 0x4b },
  doc: { mime: 'application/msword', ok: (b) => b.subarray(0, 4).toString('hex') === 'd0cf11e0' },
};

// POST /api/talents            {profile..., cv?: {name, data(base64)}} -> creates or updates a profile
// POST /api/talents?action=remove {email, t}                           -> deletes profile and CV (signed link)
export default async function handler(req, res) {
  // GET ?e=&t= -> the profile behind a signed edit link (to pre-fill the form)
  if (req.method === 'GET') {
    if (limited(req, 'talget', 20)) return send(res, 429, { error: 'too_many_requests' });
    const email = clean(req.query?.e, 200).toLowerCase();
    if (!EMAIL_RE.test(email) || !talentOk(email, req.query?.t)) return send(res, 400, { error: 'invalid_link' });
    try {
      const t = await readJSON('talents/' + hash(email) + '.json');
      if (!t) return send(res, 404, { error: 'not_found' });
      const { cv, ...rest } = t;
      return send(res, 200, { talent: { ...rest, cv: cv ? { name: cv.name, size: cv.size } : null } });
    } catch (e) {
      console.error(e);
      return send(res, 500, { error: 'storage_error' });
    }
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
  const b = body(req);

  if (req.query?.action === 'remove') {
    if (limited(req, 'talrm', 10)) return send(res, 429, { error: 'too_many_requests' });
    const email = clean(b.email, 200).toLowerCase();
    if (!EMAIL_RE.test(email) || !talentOk(email, b.t)) return send(res, 400, { error: 'invalid_link' });
    try {
      const id = hash(email), old = await readJSON('talents/' + id + '.json');
      if (old?.cv?.path) await remove(old.cv.path);
      if (old) await remove('talents/' + id + '.json');
      return send(res, 200, { ok: true });
    } catch (e) {
      console.error(e);
      return send(res, 500, { error: 'storage_error' });
    }
  }

  if (limited(req, 'tal', 5)) return send(res, 429, { error: 'too_many_requests' });
  if (b.website) return send(res, 200, { ok: true }); // honeypot
  if (b.consent !== true) return send(res, 400, { error: 'consent_required' });
  const t = normalizeTalent(b);
  if (!talentValid(t)) return send(res, 400, { error: 'invalid_profile' });

  let file = null;
  if (b.cv && b.cv.data) {
    const ext = String(b.cv.name || '').toLowerCase().split('.').pop();
    const type = TYPES[ext];
    if (!type) return send(res, 400, { error: 'cv_type' });
    const buf = Buffer.from(String(b.cv.data), 'base64');
    if (!buf.length || buf.length > MAX_CV) return send(res, 400, { error: 'cv_size' });
    if (!type.ok(buf)) return send(res, 400, { error: 'cv_type' });
    file = { buf, ext, mime: type.mime, name: clean(b.cv.name, 120), size: buf.length };
  }

  try {
    const id = hash(t.email), old = await readJSON('talents/' + id + '.json');
    // an existing profile can only be replaced through the signed link sent by e-mail
    if (old && !talentOk(t.email, b.t)) return send(res, 409, { error: 'exists' });
    let cv = old?.cv || null;
    if (file) {
      if (cv?.path && cv.path !== 'cvs/' + id + '.' + file.ext) await remove(cv.path);
      cv = { path: 'cvs/' + id + '.' + file.ext, name: file.name, type: file.mime, size: file.size };
      await writeFile(cv.path, file.buf, file.mime);
    }
    const now = new Date().toISOString();
    await writeJSON('talents/' + id + '.json', { ...t, cv, at: old?.at || now, updatedAt: now });
    await notify((old ? 'Fiche mise à jour : ' : 'Nouvelle fiche talent : ') + t.name, `${t.name} <${t.email}>\n${t.specs.join(', ')}\n${t.level}`);
    const q = 'e=' + encodeURIComponent(t.email) + '&t=' + talentToken(t.email);
    const manage = siteOrigin(req) + '/desinscription?s=emplois&' + q, edit = siteOrigin(req) + '/emplois?' + q + '#fiche';
    try {
      await sendMails([{
        to: [t.email],
        subject: old ? 'Votre fiche Archivexa est à jour' : 'Votre fiche est enregistrée chez Archivexa',
        text: `Bonjour ${t.name},\n\nVotre fiche est ${old ? 'mise à jour' : 'enregistrée'}. Vous recevrez par e-mail les offres qui correspondent à votre profil.\n\nModifier ma fiche (gardez cet e-mail) : ${edit}\nSupprimer ma fiche et ne plus rien recevoir : ${manage}\n\nArchivexa`,
        html: `<p>Bonjour ${escHtml(t.name)},</p><p>Votre fiche est ${old ? 'mise à jour' : 'enregistrée'}. Vous recevrez par e-mail les offres qui correspondent à votre profil.</p><p><a href="${escHtml(edit)}">Modifier ma fiche</a> (gardez cet e-mail : ce lien vous est personnel).</p><p style="color:#667">Pour supprimer votre fiche et ne plus rien recevoir : <a href="${escHtml(manage)}">supprimer ma fiche</a>.</p><p>Archivexa</p>`,
      }]);
    } catch (e) {
      console.error(e); // the profile is saved even if the confirmation e-mail fails
    }
    return send(res, 200, { ok: true, updated: !!old, cote: 'AXA-TAL-' + id.slice(0, 6).toUpperCase() });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'storage_error' });
  }
}
