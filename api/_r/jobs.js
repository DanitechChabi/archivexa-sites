import { listJSON } from './_lib/store.js';
import { send } from './_lib/http.js';
import { jobIsOpen, publicJob, SPECS, LEVELS, CONTRACTS, ZONES } from './_lib/jobs.js';

// GET /api/jobs -> open offers (public) and the vocabulary used by the forms.
export default async function handler(req, res) {
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
