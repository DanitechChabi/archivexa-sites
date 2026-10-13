import crypto from 'node:crypto';
import { listJSON, writeJSON } from './_lib/store.js';
import { send, body, clean, limited, notify, sendMails, escHtml, EMAIL_RE } from './_lib/http.js';
import { jobIsOpen, publicJob, normalizeJob, SPECS, LEVELS, CONTRACTS, ZONES } from './_lib/jobs.js';

// GET  /api/jobs -> open offers (public) and the vocabulary used by the forms.
// POST /api/jobs -> an employer submits an offer; it waits for validation in the admin (status "pending").
export default async function handler(req, res) {
  if (req.method === 'POST') return submit(req, res);
  if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' });
  try {
    const items = await listJSON('jobs/');
    const jobs = items
      .map(({ pathname, data }) => publicJob(pathname.replace(/^jobs\//, '').replace(/\.json$/, ''), data))
      .filter((j) => jobIsOpen(j))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return send(res, 200, { jobs, vocab: { SPECS, LEVELS, CONTRACTS, ZONES } });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'storage_error' });
  }
}

async function submit(req, res) {
  if (limited(req, 'jobsub', 4)) return send(res, 429, { error: 'too_many_requests' });
  const b = body(req);
  if (b.website) return send(res, 200, { ok: true }); // honeypot
  if (b.consent !== true) return send(res, 400, { error: 'consent_required' });
  const contact = { org: clean(b.org, 140), name: clean(b.contactName, 120), email: clean(b.email, 200).toLowerCase(), phone: clean(b.phone, 40) };
  const job = normalizeJob({ ...b, org: b.hideOrg ? '' : b.org, status: 'pending' });
  if (!contact.org || !contact.name || !EMAIL_RE.test(contact.email) || !job.title || !job.specs.length || job.desc.length < 30) return send(res, 400, { error: 'invalid_offer' });
  if (!job.apply) job.apply = contact.email;
  try {
    const id = new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + crypto.randomBytes(3).toString('hex');
    const now = new Date().toISOString();
    await writeJSON('jobs/' + id + '.json', { ...job, contact, createdAt: now, updatedAt: now, sent: [], sentAt: null });
    await notify('Offre à valider : ' + job.title, `${job.title}\n${contact.org} · ${contact.name} <${contact.email}> ${contact.phone}\nÀ valider dans l'admin, onglet Offres.`);
    try {
      await sendMails([{
        to: [contact.email],
        subject: 'Votre offre « ' + job.title + ' » est bien reçue',
        text: `Bonjour ${contact.name},\n\nNous avons bien reçu votre offre « ${job.title} ». Nous la relisons et vous contactons si un point est à préciser. Elle sera ensuite publiée et envoyée aux profils correspondants.\n\nArchivexa`,
        html: `<p>Bonjour ${escHtml(contact.name)},</p><p>Nous avons bien reçu votre offre « ${escHtml(job.title)} ». Nous la relisons et vous contactons si un point est à préciser. Elle sera ensuite publiée et envoyée aux profils correspondants.</p><p>Archivexa</p>`,
      }]);
    } catch (e) {
      console.error(e);
    }
    return send(res, 200, { ok: true });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'storage_error' });
  }
}
