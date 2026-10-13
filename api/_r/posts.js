import { listJSON } from './_lib/store.js';
import { send, isAdmin } from './_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' });
  const all = req.query?.all === '1' && isAdmin(req);
  try {
    const items = await listJSON('posts/');
    const posts = items
      .map(({ pathname, data }) => ({ ...data, id: pathname.replace(/^posts\//, '').replace(/\.json$/, '') }))
      .filter((p) => all || p.status !== 'draft')
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return send(res, 200, { posts });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'storage_error' });
  }
}
