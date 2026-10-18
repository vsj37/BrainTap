import test from 'node:test';
import assert from 'node:assert/strict';
import { pickRounds, puzzleNumber, shareText } from '../src/daily.js';

const mk = (levels) => Object.fromEntries(levels.map((l, i) => [`S${i}`, { level: l }]));
const structures = mk([1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5]);
const LV = [[1], [2, 3], [4, 5]];

test('same seed -> same picks; different seed -> (very likely) different', () => {
  assert.deepEqual(pickRounds(structures, '2026-10-19', LV), pickRounds(structures, '2026-10-19', LV));
  const days = new Set();
  for (let d = 1; d <= 20; d++) days.add(pickRounds(structures, `2026-11-${String(d).padStart(2, '0')}`, LV).join());
  assert.ok(days.size > 10);
});

test('each round respects its level pool and picks are unique', () => {
  for (let d = 1; d <= 50; d++) {
    const picks = pickRounds(structures, `seed${d}`, LV);
    picks.forEach((k, i) => assert.ok(LV[i].includes(structures[k].level)));
    assert.equal(new Set(picks).size, 3);
  }
});

test('falls back to any unused structure when a level pool is empty', () => {
  const picks = pickRounds(mk([1, 1, 2, 3]), 'x', LV); // nothing at levels 4-5
  assert.equal(new Set(picks).size, 3);
});

test('puzzleNumber and shareText', () => {
  assert.equal(puzzleNumber('2026-10-19'), 1);
  assert.equal(puzzleNumber('2026-10-21'), 3);
  const t = shareText({ num: 3, day: '2026-10-21', scores: [25, 20, 5], maxes: [25, 35, 40] });
  assert.equal(t, 'BrainTap #3 · 2026-10-21\n🧠 50/100\n🟩🟨🟥\n25/25 · 20/35 · 5/40');
});
