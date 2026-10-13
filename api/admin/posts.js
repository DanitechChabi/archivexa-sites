import { writeJSON, remove } from '../_lib/store.js';
import { send, body, clean, isAdmin } from '../_lib/http.js';

const CATS = ['Archivage', 'Numérisation', 'GED', 'Plateformes'];
const ID_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;

export default async function handler(req, res) {
  if (!isAdmin(req)) return send(res, 401, { error: 'unauthorized' });
  try {
    if (req.method === 'PUT') {
      const b = body(req);
      const id = clean(b.id, 80);
      if (!ID_RE.test(id)) return send(res, 400, { error: 'invalid_id' });
      const post = {
        title: clean(b.title, 200),
        cat: CATS.includes(b.cat) ? b.cat : 'Archivage',
        date: /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : new Date().toISOString().slice(0, 10),
        status: b.status === 'draft' ? 'draft' : 'published',
        excerpt: clean(b.excerpt, 300),
        body: String(b.body ?? '').slice(0, 60000),
        cover: [0, 1, 2, 3].includes(+b.cover) ? +b.cover : 0,
        updatedAt: new Date().toISOString(),
      };
      if (!post.title) return send(res, 400, { error: 'missing_title' });
      await writeJSON('posts/' + id + '.json', post);
      return send(res, 200, { ok: true, id });
    }
    if (req.method === 'DELETE') {
      const id = clean(req.query?.id, 80);
      if (!ID_RE.test(id)) return send(res, 400, { error: 'invalid_id' });
      await remove('posts/' + id + '.json');
      return send(res, 200, { ok: true });
    }
    return send(res, 405, { error: 'method_not_allowed' });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'storage_error' });
  }
}
