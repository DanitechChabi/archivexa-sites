import { listJSON } from '../_lib/store.js';
import { send, isAdmin, unsubToken, siteOrigin } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' });
  if (!isAdmin(req)) return send(res, 401, { error: 'unauthorized' });
  try {
    const [subs, reqs] = await Promise.all([listJSON('subscribers/'), listJSON('requests/')]);
    const byDate = (a, b) => String(b.at).localeCompare(String(a.at));
    return send(res, 200, {
      subscribers: subs.map((x) => ({ ...x.data, unsub: siteOrigin(req) + '/desinscription?e=' + encodeURIComponent(x.data.email) + '&t=' + unsubToken(x.data.email) })).sort(byDate),
      requests: reqs.map((x) => x.data).sort(byDate),
    });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'storage_error' });
  }
}
