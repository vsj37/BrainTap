import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPools, pickRounds, puzzleNumber, shareText } from '../src/daily.js';
import { ROUND_RULES } from '../src/config.js';
import { berlinDay, msUntilBerlinMidnight } from '../src/day.js';

// levels: L1 x3, L2 x2, L3 x3, L4 x5 (areas 50..10), L5 x4
const defs = { A: 1, B: 1, C: 1, D: 2, E: 2, F: 3, G: 3, H: 3, I: 4, J: 4, K: 4, L: 4, M: 4, N: 5, O: 5, P: 5, Q: 5 };
const area = { I: 10, J: 50, K: 30, L: 20, M: 40 }; // L4 by size: J 50, M 40, K 30, L 20, I 10
const structures = Object.fromEntries(Object.entries(defs).map(([k, level]) => [k, { level, peakAreaMm2: area[k] }]));

test('buildPools: round 1 = levels 1-2; round 2 = level 3 + larger half of level 4; round 3 = rest of 4 + level 5', () => {
  const [r1, r2, r3] = buildPools(structures, ROUND_RULES);
  assert.deepEqual(r1.sort(), ['A', 'B', 'C', 'D', 'E']);
  assert.deepEqual(r2.sort(), ['F', 'G', 'H', 'J', 'K', 'M']); // 5 regions at L4 -> first half = ceil(5/2) = 3 largest
  assert.deepEqual(r3.sort(), ['I', 'L', 'N', 'O', 'P', 'Q']);
});

test('buildPools: every region is in exactly one pool; without area data the split is A-Z', () => {
  const plain = Object.fromEntries(Object.entries(defs).map(([k, level]) => [k, { level }]));
  const pools = buildPools(plain, ROUND_RULES);
  assert.equal(pools.flat().length, Object.keys(plain).length);
  assert.equal(new Set(pools.flat()).size, Object.keys(plain).length);
  assert.deepEqual(pools[1].filter((k) => plain[k].level === 4).sort(), ['I', 'J', 'K']);
});

test('same seed -> same picks; different seeds differ', () => {
  const pools = buildPools(structures, ROUND_RULES);
  assert.deepEqual(pickRounds(structures, '2026-10-19', pools), pickRounds(structures, '2026-10-19', pools));
  const days = new Set();
  for (let d = 1; d <= 20; d++) days.add(pickRounds(structures, `2026-11-${String(d).padStart(2, '0')}`, pools).join());
  assert.ok(days.size > 10);
});

test('each round draws from its own pool and picks are unique', () => {
  const pools = buildPools(structures, ROUND_RULES);
  for (let d = 1; d <= 50; d++) {
    const picks = pickRounds(structures, `seed${d}`, pools);
    picks.forEach((k, i) => assert.ok(pools[i].includes(k), `${k} not in pool ${i}`));
    assert.equal(new Set(picks).size, 3);
  }
});

test('empty pool falls back to any unused region', () => {
  const tiny = { A: { level: 1 }, B: { level: 1 }, C: { level: 2 } }; // nothing at levels 3-5
  const picks = pickRounds(tiny, 'x', buildPools(tiny, ROUND_RULES));
  assert.equal(new Set(picks).size, 3);
});

test('puzzleNumber and shareText', () => {
  assert.equal(puzzleNumber('2026-10-19'), 1);
  assert.equal(puzzleNumber('2026-10-21'), 3);
  const t = shareText({ num: 3, day: '2026-10-21', scores: [25, 20, 5], maxes: [25, 35, 40] });
  assert.equal(t, 'BrainTap #3 · 2026-10-21\n🧠 50/100\n🟩🟨🟥\n25/25 · 20/35 · 5/40');
});

test('daily round 1 is always CA1 when the atlas has it; practice and other rounds are unaffected', () => {
  const withCA1 = { ...structures, CA1: { level: 2 } };
  const daily = buildPools(withCA1, ROUND_RULES);
  assert.deepEqual(daily[0], ['CA1']);
  assert.ok(!daily[1].includes('CA1') && !daily[2].includes('CA1'));
  for (let d = 1; d <= 20; d++) assert.equal(pickRounds(withCA1, `s${d}`, daily)[0], 'CA1');
  const practice = buildPools(withCA1, ROUND_RULES, { daily: false });
  assert.ok(practice[0].includes('CA1') && practice[0].length > 1);
});

test('berlinDay follows Berlin time, including daylight saving', () => {
  assert.equal(berlinDay(Date.parse('2026-10-28T22:59:00Z')), '2026-10-28'); // 23:59 CET
  assert.equal(berlinDay(Date.parse('2026-10-28T23:00:00Z')), '2026-10-29'); // 00:00 CET
  assert.equal(berlinDay(Date.parse('2026-07-01T21:59:00Z')), '2026-07-01'); // 23:59 CEST
  assert.equal(berlinDay(Date.parse('2026-07-01T22:00:00Z')), '2026-07-02'); // 00:00 CEST
  const t = Date.parse('2026-10-28T20:00:00Z'); // 21:00 CET -> 3 h to midnight
  assert.ok(Math.abs(msUntilBerlinMidnight(t) - 3 * 36e5) <= 1000);
  const dst = Date.parse('2026-10-24T22:00:00Z'); // 00:00 CEST on the day the clocks go back: that day is 25 h long
  assert.ok(Math.abs(msUntilBerlinMidnight(dst) - 25 * 36e5) <= 1000);
});
