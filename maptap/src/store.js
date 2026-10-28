// Player profile + score history. Pure functions (no DOM) so they can be unit-tested.
// Profile shape: { v, name, created, history: { 'YYYY-MM-DD': { scores, maxes, targets } }, progress: { day, scores } | null }
import { STORAGE_KEY } from './config.js';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 864e5;
const MAX_ROUNDS = 10;
const MAX_NAME = 24;

// ---------- dates (UTC, as 'YYYY-MM-DD' strings) ----------
export const dayToMs = (d) => Date.parse(`${d}T00:00:00Z`);
export const msToDay = (ms) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (d, n) => msToDay(dayToMs(d) + n * DAY_MS);
export const weekStart = (d) => addDays(d, -((new Date(dayToMs(d)).getUTCDay() + 6) % 7)); // Monday
const monthStart = (d) => `${d.slice(0, 7)}-01`;
const prevMonth = (first) => {
  const [y, m] = first.split('-').map(Number);
  return msToDay(Date.UTC(y, m - 2, 1));
};

// ---------- profile ----------
export const emptyProfile = (now = new Date()) => ({
  v: 1,
  name: '',
  created: now.toISOString().slice(0, 10),
  history: {},
  progress: null,
});

const sum = (a) => a.reduce((x, y) => x + y, 0);
export const entryTotal = (e) => sum(e.scores);
export const entryMax = (e) => sum(e.maxes);
export const pct = (e) => Math.round((100 * entryTotal(e)) / entryMax(e));

// One play per day: a second result for the same day is ignored.
export function recordResult(profile, day, { scores, targets = [], maxes }) {
  if (!DAY_RE.test(day)) throw new Error(`bad day ${day}`);
  if (profile.history[day]) return profile;
  return { ...profile, history: { ...profile.history, [day]: { scores, maxes, targets } }, progress: null };
}

export const saveProgress = (profile, day, scores) => ({ ...profile, progress: { day, scores: [...scores] } });

export function streaks(history, today) {
  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of Object.keys(history).sort()) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  let current = 0;
  let d = history[today] ? today : addDays(today, -1); // streak stays alive until today is over
  while (history[d]) {
    current++;
    d = addDays(d, -1);
  }
  return { current, best };
}

export function summary(history) {
  const all = Object.values(history).map(pct);
  if (!all.length) return { played: 0, avg: null, best: null };
  return { played: all.length, avg: Math.round(sum(all) / all.length), best: Math.max(...all) };
}

// Last n buckets (day | week | month) ending at `today`, each { key, count, avg } (avg null = no games).
export function series(history, unit, today, n) {
  const keyOf = (d) => (unit === 'day' ? d : unit === 'week' ? weekStart(d) : monthStart(d));
  const step = (k) => (unit === 'day' ? addDays(k, -1) : unit === 'week' ? addDays(k, -7) : prevMonth(k));
  const keys = [];
  for (let k = keyOf(today), i = 0; i < n; i++, k = step(k)) keys.unshift(k);
  const acc = new Map(keys.map((k) => [k, { sum: 0, count: 0 }]));
  for (const [d, e] of Object.entries(history)) {
    const a = acc.get(keyOf(d));
    if (a) {
      a.sum += pct(e);
      a.count++;
    }
  }
  return keys.map((key) => {
    const a = acc.get(key);
    return { key, count: a.count, avg: a.count ? Math.round(a.sum / a.count) : null };
  });
}

// ---------- validation (used for stored data AND imported backup codes: never trust either) ----------
export function sanitize(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('This is not a valid profile.');
  const history = {};
  for (const [d, e] of Object.entries(obj.history && typeof obj.history === 'object' ? obj.history : {})) {
    if (!DAY_RE.test(d) || Number.isNaN(dayToMs(d))) continue;
    const { scores, maxes } = e ?? {};
    if (!Array.isArray(scores) || !Array.isArray(maxes)) continue;
    if (scores.length < 1 || scores.length > MAX_ROUNDS || scores.length !== maxes.length) continue;
    if (![...scores, ...maxes].every((x) => typeof x === 'number' && Number.isFinite(x))) continue;
    if (maxes.some((m) => m <= 0) || scores.some((s, i) => s < 0 || s > maxes[i])) continue;
    history[d] = {
      scores: scores.map(Math.round),
      maxes: maxes.map(Math.round),
      targets: Array.isArray(e.targets) ? e.targets.filter((t) => typeof t === 'string').slice(0, MAX_ROUNDS).map((t) => t.slice(0, 40)) : [],
    };
  }
  return {
    v: 1,
    name: typeof obj.name === 'string' ? obj.name.slice(0, MAX_NAME) : '',
    created: typeof obj.created === 'string' && DAY_RE.test(obj.created) ? obj.created : '',
    history,
    progress: null,
  };
}

function sanitizeProgress(p) {
  if (!p || typeof p.day !== 'string' || !DAY_RE.test(p.day) || !Array.isArray(p.scores)) return null;
  if (p.scores.length > MAX_ROUNDS || !p.scores.every((s) => typeof s === 'number' && Number.isFinite(s) && s >= 0)) return null;
  return { day: p.day, scores: p.scores };
}

// Merge days from the server (or any untrusted source) into local history. Invalid entries are dropped; local days win.
export function mergeHistory(local, incoming) {
  const clean = sanitize({ history: incoming }).history;
  return { ...clean, ...local };
}

// ---------- persistence ----------
export function loadProfile(storage, now = new Date()) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyProfile(now);
    const obj = JSON.parse(raw);
    const p = sanitize(obj);
    p.progress = sanitizeProgress(obj.progress);
    if (!p.created) p.created = now.toISOString().slice(0, 10);
    return p;
  } catch {
    return emptyProfile(now);
  }
}

export function saveProfile(storage, profile) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}
