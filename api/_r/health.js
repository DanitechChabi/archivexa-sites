import { put, list, del } from '@vercel/blob';
import { send, mailReady } from './_lib/http.js';

// GET /api/health -> what is configured, and whether the Blob store answers (no secret is returned).
export default async function handler(req, res) {
  const out = {
    stockage_relie: !!process.env.BLOB_READ_WRITE_TOKEN,
    stockage_lecture: null,
    stockage_ecriture: null,
    admin_configure: !!(process.env.ADMIN_PASSWORD && process.env.ADMIN_SECRET),
    live_configure: !!(process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET),
    emails_configures: mailReady(),
  };
  const why = (e) => String((e && (e.name + ' : ' + e.message)) || e).replace(/vercel_blob_rw_[\w-]+/g, '***').slice(0, 220);
  try { await list({ limit: 1 }); out.stockage_lecture = 'ok'; } catch (e) { out.stockage_lecture = why(e); }
  try {
    await put('health/check.json', '{"ok":true}', { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });
    await del('health/check.json');
    out.stockage_ecriture = 'ok';
  } catch (e) { out.stockage_ecriture = why(e); }
  return send(res, 200, out);
}
