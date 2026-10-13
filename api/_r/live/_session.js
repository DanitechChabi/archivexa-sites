import crypto from 'node:crypto';
import { readJSON, listJSON } from '../_lib/store.js';

export const CODE_RE = /^AXA-[A-Z0-9]{4}-[A-Z0-9]{2}$/;
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function newCode() {
  const pick = (n) => Array.from(crypto.randomBytes(n), (b) => ALPHA[b % ALPHA.length]).join('');
  return 'AXA-' + pick(4) + '-' + pick(2);
}

export function publicSession(s) {
  return { code: s.code, title: s.title, formation: s.formation, date: s.date, duration: s.duration, trainer: s.trainer, modules: s.modules || [] };
}

export async function getSession(code) {
  if (!CODE_RE.test(code)) return null;
  return await readJSON('live/sessions/' + code + '.json');
}

export async function allSessions() {
  return (await listJSON('live/sessions/')).map((x) => x.data);
}

export function liveConfigured() {
  return !!(process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET);
}
