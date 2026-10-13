import { Readable } from 'node:stream';
import { listJSON, readJSON, readFile, remove } from '../_lib/store.js';
import { send, clean, isAdmin } from '../_lib/http.js';

const ID_RE = /^[a-f0-9]{24}$/;

// GET    /api/admin/talents          -> all profiles
// GET    /api/admin/talents?cv=<id>  -> downloads the CV
// DELETE /api/admin/talents?id=<id>  -> deletes profile and CV
export default async function handler(req, res) {
  if (!isAdmin(req)) return send(res, 401, { error: 'unauthorized' });
  try {
    if (req.method === 'GET' && req.query?.cv) {
      const id = clean(req.query.cv, 30);
      if (!ID_RE.test(id)) return send(res, 400, { error: 'invalid_id' });
      const t = await readJSON('talents/' + id + '.json');
      if (!t?.cv?.path) return send(res, 404, { error: 'not_found' });
      const f = await readFile(t.cv.path);
      if (!f) return send(res, 404, { error: 'not_found' });
      const safe = (t.cv.name || 'cv').replace(/[^\w.\- ]+/g, '_');
      res.setHeader('Content-Type', t.cv.type || f.contentType);
      res.setHeader('Content-Disposition', 'attachment; filename="' + safe + '"');
      res.setHeader('Cache-Control', 'no-store');
      res.statusCode = 200;
      Readable.fromWeb(f.stream).pipe(res);
      return;
    }
    if (req.method === 'GET') {
      const items = await listJSON('talents/');
      // profiles not updated for 2 years are deleted (retention announced on /legal)
      const limit = Date.now() - 2 * 365 * 86400000, keep = [];
      for (const it of items) {
        if (new Date(it.data.updatedAt || it.data.at || 0).getTime() < limit) {
          if (it.data.cv?.path) await remove(it.data.cv.path);
          await remove(it.pathname);
        } else keep.push(it);
      }
      const talents = keep
        .map(({ pathname, data }) => ({ ...data, id: pathname.replace(/^talents\//, '').replace(/\.json$/, '') }))
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      return send(res, 200, { talents });
    }
    if (req.method === 'DELETE') {
      const id = clean(req.query?.id, 30);
      if (!ID_RE.test(id)) return send(res, 400, { error: 'invalid_id' });
      const t = await readJSON('talents/' + id + '.json');
      if (t?.cv?.path) await remove(t.cv.path);
      await remove('talents/' + id + '.json');
      return send(res, 200, { ok: true });
    }
    return send(res, 405, { error: 'method_not_allowed' });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'storage_error' });
  }
}
