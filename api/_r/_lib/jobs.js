// Shared vocabulary and matching rules for the job board (talents <-> offers).
import { clean, EMAIL_RE } from './http.js';

export const SPECS = [
  'Archivage physique',
  'Records management',
  'Numérisation',
  'GED',
  'Archives numériques',
  'Documentation et bibliothèque',
  'Archives médicales',
  'Données et data',
];
export const LEVELS = ['Débutant (moins de 2 ans)', '2 à 5 ans', '5 à 10 ans', 'Plus de 10 ans'];
export const CONTRACTS = ['CDI', 'CDD', 'Stage', 'Mission ou freelance', 'Consultance'];
export const ZONES = ['Cotonou', 'Abomey-Calavi', 'Porto-Novo', 'Parakou', 'Autre ville du Bénin', "Afrique de l'Ouest", 'À distance'];
export const ANYWHERE = 'Toutes les zones';

const pick = (arr, allowed, max = 12) =>
  (Array.isArray(arr) ? arr : []).map((x) => clean(x, 80)).filter((x) => allowed.includes(x)).slice(0, max);

export function normalizeTalent(b) {
  const zones = Array.isArray(b.zones) && b.zones.includes(ANYWHERE) ? [ANYWHERE] : pick(b.zones, ZONES);
  const linkedin = clean(b.linkedin, 300);
  return {
    name: clean(b.name, 120),
    email: clean(b.email, 200).toLowerCase(),
    phone: clean(b.phone, 40),
    city: clean(b.city, 80),
    title: clean(b.title, 120),
    specs: pick(b.specs, SPECS),
    level: LEVELS.includes(b.level) ? b.level : '',
    contracts: pick(b.contracts, CONTRACTS),
    zones,
    degree: clean(b.degree, 160),
    linkedin: /^https?:\/\//i.test(linkedin) ? linkedin : '',
    about: clean(b.about, 800),
    alerts: true,
  };
}
export function talentValid(t) {
  return t.name && EMAIL_RE.test(t.email) && t.specs.length > 0 && t.level;
}

export function normalizeJob(b) {
  const apply = clean(b.apply, 300);
  return {
    title: clean(b.title, 140),
    org: clean(b.org, 140),
    zone: ZONES.includes(b.zone) ? b.zone : ZONES[0],
    contract: CONTRACTS.includes(b.contract) ? b.contract : CONTRACTS[0],
    specs: pick(b.specs, SPECS),
    minLevel: LEVELS.includes(b.minLevel) ? b.minLevel : LEVELS[0],
    desc: String(b.desc ?? '').replace(/\u0000/g, '').trim().slice(0, 4000),
    apply: /^https?:\/\//i.test(apply) || EMAIL_RE.test(apply) ? apply : '',
    deadline: /^\d{4}-\d{2}-\d{2}$/.test(b.deadline) ? b.deadline : '',
    status: ['closed', 'pending'].includes(b.status) ? b.status : 'open',
  };
}

export function jobIsOpen(j, now = new Date()) {
  if (j.status !== 'open') return false;
  if (!j.deadline) return true;
  return new Date(j.deadline + 'T23:59:59') >= now;
}

// A talent receives an offer when: at least one specialty in common (or the offer names none),
// the contract type is wanted (or no preference), the zone suits (or "Toutes les zones"),
// and the experience is at least the level asked.
export function matches(job, t) {
  if (t.alerts === false) return false;
  if (job.specs.length && !job.specs.some((s) => t.specs.includes(s))) return false;
  if (t.contracts.length && !t.contracts.includes(job.contract)) return false;
  if (t.zones.length && !t.zones.includes(ANYWHERE) && !t.zones.includes(job.zone)) return false;
  return LEVELS.indexOf(t.level) >= LEVELS.indexOf(job.minLevel);
}

export function publicJob(id, j) {
  const { sent, sentAt, contact, ...rest } = j;
  return { id, ...rest };
}
