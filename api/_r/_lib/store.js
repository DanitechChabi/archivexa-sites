// Storage on a private Vercel Blob store: one JSON file per subscriber, request and article.
import { put, list, get, del } from '@vercel/blob';

const ACCESS = 'private';

export async function writeJSON(pathname, data) {
  await put(pathname, JSON.stringify(data), {
    access: ACCESS,
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export async function readJSON(pathname) {
  const res = await get(pathname, { access: ACCESS, useCache: false });
  if (!res || res.statusCode !== 200 || !res.stream) return null;
  return await new Response(res.stream).json();
}

export async function listJSON(prefix) {
  const blobs = [];
  let cursor;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  const items = await Promise.all(
    blobs.map(async (b) => {
      try {
        const data = await readJSON(b.pathname);
        return data ? { pathname: b.pathname, data } : null;
      } catch {
        return null;
      }
    })
  );
  return items.filter(Boolean);
}

export async function exists(prefix) {
  const page = await list({ prefix, limit: 1 });
  return page.blobs.length > 0;
}

export async function remove(pathname) {
  await del(pathname);
}

// Binary files (CVs). Same private store.
export async function writeFile(pathname, buffer, contentType) {
  await put(pathname, buffer, { access: ACCESS, contentType, addRandomSuffix: false, allowOverwrite: true });
}
export async function readFile(pathname) {
  const res = await get(pathname, { access: ACCESS, useCache: false });
  if (!res || res.statusCode !== 200 || !res.stream) return null;
  return { stream: res.stream, contentType: res.blob?.contentType || 'application/octet-stream' };
}
