// Seeded daily puzzle selection + share string. Pure, no DOM.

export const EPOCH = '2026-10-19'; // puzzle #1

function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// UTC date, so every player worldwide gets the same puzzle.
export const dailyKey = (d = new Date()) => d.toISOString().slice(0, 10);

export const puzzleNumber = (key) => Math.floor((Date.parse(key) - Date.parse(EPOCH)) / 864e5) + 1;

// Candidate regions per round, from ROUND_RULES (see config.js). A rule can also take half of one level: that level's
// larger regions (peak cross-section area, when the atlas data has it; otherwise A-Z) are the "first" half, the rest the "second".
export function buildPools(structures, rules) {
  const keys = Object.keys(structures);
  const halves = (level) => {
    const at = keys
      .filter((k) => structures[k].level === level)
      .sort((a, b) => (structures[b].peakAreaMm2 ?? 0) - (structures[a].peakAreaMm2 ?? 0) || a.localeCompare(b));
    const cut = Math.ceil(at.length / 2);
    return { first: at.slice(0, cut), second: at.slice(cut) };
  };
  return rules.map((r) => {
    const pool = keys.filter((k) => r.levels.includes(structures[k].level));
    if (r.splitLevel) pool.push(...halves(r.splitLevel.level)[r.splitLevel.part]);
    return pool;
  });
}

// One region per round, drawn from that round's pool. Same seed -> same picks.
// If a pool is exhausted/empty (e.g. mock data), falls back to any unused region.
export function pickRounds(structures, seed, pools) {
  const rng = mulberry32(xmur3(seed));
  const keys = Object.keys(structures);
  const used = new Set();
  return pools.map((pool) => {
    let cand = pool.filter((k) => !used.has(k));
    if (!cand.length) cand = keys.filter((k) => !used.has(k));
    if (!cand.length) cand = keys;
    const k = cand[Math.floor(rng() * cand.length)];
    used.add(k);
    return k;
  });
}

const sum = (a) => a.reduce((x, y) => x + y, 0);

export function shareText({ num, day, scores, maxes, appName = 'BrainTap' }) {
  const squares = scores.map((s, i) => (s / maxes[i] >= 0.9 ? '🟩' : s / maxes[i] >= 0.5 ? '🟨' : '🟥')).join('');
  const head = day ? `${appName} #${num} · ${day}` : `${appName} (practice)`;
  return `${head}\n🧠 ${sum(scores)}/${sum(maxes)}\n${squares}\n${scores.map((s, i) => `${s}/${maxes[i]}`).join(' · ')}`;
}
