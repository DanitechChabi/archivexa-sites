import crypto from 'node:crypto';
import { listJSON, readJSON, writeJSON, remove } from '../_lib/store.js';
import { send, body, clean, isAdmin, siteOrigin, talentToken, sendMails, mailReady, escHtml, EMAIL_RE } from '../_lib/http.js';
import { normalizeJob, matches, jobIsOpen } from '../_lib/jobs.js';

const ID_RE = /^[a-z0-9-]{6,40}$/;

async function talents() {
  return (await listJSON('talents/')).map(({ pathname, data }) => ({ ...data, id: pathname.replace(/^talents\//, '').replace(/\.json$/, '') }));
}

function mailFor(job, t, origin) {
  const link = origin + '/emplois#offre-' + job.id;
  const q = 'e=' + encodeURIComponent(t.email) + '&t=' + talentToken(t.email);
  const manage = origin + '/desinscription?s=emplois&' + q, edit = origin + '/emplois?' + q + '#fiche';
  const apply = job.apply ? (EMAIL_RE.test(job.apply) ? 'mailto:' + job.apply : job.apply) : link;
  const facts = [job.org, job.zone, job.contract, job.deadline ? 'Avant le ' + new Date(job.deadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''].filter(Boolean);
  const excerpt = job.desc.length > 600 ? job.desc.slice(0, 600).replace(/\s+\S*$/, '') + '…' : job.desc;
  return {
    to: [t.email],
    subject: 'Offre : ' + job.title + (job.org ? ' · ' + job.org : ''),
    text: `Bonjour ${t.name},\n\nCette offre correspond à votre fiche Archivexa.\n\n${job.title}\n${facts.join(' · ')}\n\n${excerpt}\n\nVoir l'offre : ${link}\nPostuler : ${job.apply || link}\n\nModifier ma fiche : ${edit}\nNe plus recevoir d'offres et supprimer ma fiche : ${manage}\n\nArchivexa`,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0b1430">
<p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#2f6bff;margin:0 0 6px">Archivexa · Offre d'emploi</p>
<p>Bonjour ${escHtml(t.name)},</p><p>Cette offre correspond à votre fiche.</p>
<div style="border:1px solid #d6dcf0;border-radius:14px;padding:18px 20px;margin:16px 0">
<h2 style="margin:0 0 6px;font-size:20px">${escHtml(job.title)}</h2>
<p style="margin:0 0 12px;color:#55607f;font-size:14px">${facts.map(escHtml).join(' · ')}</p>
<p style="margin:0;white-space:pre-line;font-size:14.5px;line-height:1.6">${escHtml(excerpt)}</p></div>
<p><a href="${escHtml(apply)}" style="display:inline-block;background:#2f6bff;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:bold">Postuler</a>
&nbsp; <a href="${escHtml(link)}" style="color:#2f6bff">Voir l'offre sur le site</a></p>
<p style="color:#8792b8;font-size:12.5px;margin-top:28px">Vous recevez cet e-mail parce que vous avez déposé votre fiche sur archivexa. <a href="${escHtml(edit)}" style="color:#8792b8">Modifier ma fiche</a> · <a href="${escHtml(manage)}" style="color:#8792b8">Ne plus recevoir d'offres et supprimer ma fiche</a>.</p></div>`,
  };
}

// GET    /api/admin/jobs                          -> all offers with match counts
// PUT    /api/admin/jobs  {id?, ...}              -> create or update
// DELETE /api/admin/jobs?id=                      -> delete
// POST   /api/admin/jobs?id=&action=preview|send  -> list matching profiles / e-mail those not yet notified
export default async function handler(req, res) {
  if (!isAdmin(req)) return send(res, 401, { error: 'unauthorized' });
  try {
    if (req.method === 'GET') {
      const [all, ts] = await Promise.all([listJSON('jobs/'), talents()]);
      // offers (and recruiter contacts) are deleted 2 years after their deadline, or after their last update without deadline
      const limit = Date.now() - 2 * 365 * 86400000, jobs = [];
      for (const it of all) {
        const ref = new Date(it.data.deadline ? it.data.deadline + 'T23:59:59' : it.data.updatedAt || it.data.createdAt || 0).getTime();
        if (ref < limit) await remove(it.pathname); else jobs.push(it);
      }
      return send(res, 200, {
        mail: mailReady(),
        jobs: jobs
          .map(({ pathname, data }) => {
            const id = pathname.replace(/^jobs\//, '').replace(/\.json$/, '');
            const m = ts.filter((t) => matches(data, t));
            return { ...data, id, sent: undefined, sentCount: (data.sent || []).length, matchCount: m.length, pending: m.filter((t) => !(data.sent || []).includes(t.id)).length, open: jobIsOpen(data) };
          })
          .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
      });
    }
    if (req.method === 'PUT') {
      const b = body(req);
      let id = clean(b.id, 40);
      const old = id ? await readJSON('jobs/' + id + '.json') : null;
      if (id && (!ID_RE.test(id) || !old)) return send(res, 404, { error: 'not_found' });
      if (!id) id = new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + crypto.randomBytes(3).toString('hex');
      const job = normalizeJob(b);
      if (!job.title) return send(res, 400, { error: 'missing_title' });
      const now = new Date().toISOString();
      await writeJSON('jobs/' + id + '.json', { ...job, contact: old?.contact || null, createdAt: old?.createdAt || now, updatedAt: now, sent: old?.sent || [], sentAt: old?.sentAt || null });
      return send(res, 200, { ok: true, id });
    }
    if (req.method === 'DELETE') {
      const id = clean(req.query?.id, 40);
      if (!ID_RE.test(id)) return send(res, 400, { error: 'invalid_id' });
      await remove('jobs/' + id + '.json');
      return send(res, 200, { ok: true });
    }
    if (req.method === 'POST') {
      const id = clean(req.query?.id, 40), action = req.query?.action;
      if (!ID_RE.test(id)) return send(res, 400, { error: 'invalid_id' });
      const job = await readJSON('jobs/' + id + '.json');
      if (!job) return send(res, 404, { error: 'not_found' });
      job.id = id;
      const sent = job.sent || [];
      const m = (await talents()).filter((t) => matches(job, t));
      const pending = m.filter((t) => !sent.includes(t.id));
      const list = m.map((t) => ({ id: t.id, name: t.name, email: t.email, specs: t.specs, level: t.level, sent: sent.includes(t.id) }));
      if (action === 'preview') return send(res, 200, { mail: mailReady(), matches: list, pending: pending.length });
      if (action === 'send') {
        if (!jobIsOpen(job)) return send(res, 409, { error: 'job_closed' });
        if (!mailReady()) return send(res, 409, { error: 'mail_not_configured', matches: list });
        if (!pending.length) return send(res, 200, { ok: true, sent: 0 });
        const origin = siteOrigin(req);
        const n = await sendMails(pending.map((t) => mailFor(job, t, origin)));
        const { id: _drop, ...stored } = job;
        await writeJSON('jobs/' + id + '.json', { ...stored, sent: sent.concat(pending.map((t) => t.id)), sentAt: new Date().toISOString() });
        return send(res, 200, { ok: true, sent: n });
      }
      return send(res, 400, { error: 'invalid_action' });
    }
    return send(res, 405, { error: 'method_not_allowed' });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: String(e.message || '').startsWith('resend_') ? 'mail_error' : 'storage_error' });
  }
}
