import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nearestOnRegion, pointInRing, regionAt, scoreGuess } from '../src/logic.js';

// 1 coordinate unit = 1 mm in this fixture (unitUm: 1000).
const sq = (x, y, s) => [[x, y], [x + s, y], [x + s, y + s], [x, y + s]];
const data = {
  canvas: [100, 100],
  meta: { unitUm: 1000 },
  scoring: { falloffMm: 2 },
  structures: { A: {}, P: {} },
  slices: [
    { bregma: 1.0, outline: [], regions: [{ structure: 'A', polygons: [sq(1, 1, 4)] }, { structure: 'P', polygons: [sq(0, 0, 9)] }] },
    { bregma: 0.0, outline: [], regions: [] },
    { bregma: -2.0, outline: [], regions: [] },
  ],
};

test('pointInRing', () => {
  assert.equal(pointInRing([3, 3], sq(1, 1, 4)), true);
  assert.equal(pointInRing([7, 3], sq(1, 1, 4)), false);
});

test('nearestOnRegion: 0 inside, nearest edge point outside, min over rings', () => {
  assert.deepEqual(nearestOnRegion([3, 3], [sq(1, 1, 4)]), { dist: 0, q: [3, 3] });
  assert.deepEqual(nearestOnRegion([7, 3], [sq(1, 1, 4)]), { dist: 2, q: [5, 3] });
  assert.equal(nearestOnRegion([7, 3], [sq(1, 1, 4), sq(8, 2, 2)]).dist, 1);
});

test('regionAt returns the most specific nested region', () => {
  assert.equal(regionAt(data.slices[0], [3, 3]), 'A');
  assert.equal(regionAt(data.slices[0], [8, 8]), 'P');
  assert.equal(regionAt(data.slices[0], [9.5, 9.5]), null);
});

test('hit: right slice, inside region -> full points', () => {
  const r = scoreGuess({ data, ap: 1.0, p: [3, 3], key: 'A', maxPts: 40 });
  assert.equal(r.hit, true);
  assert.equal(r.pts, 40);
});

test('in-plane miss decreases linearly (1 mm of 2 mm falloff -> 50%)', () => {
  const r = scoreGuess({ data, ap: 1.0, p: [6, 3], key: 'A', maxPts: 40 });
  assert.equal(r.hit, false);
  assert.equal(r.dist2, 1);
  assert.equal(r.pts, 20);
});

test('AP miss: right ML/DV on a slice without the target (1 mm off -> 50%), correct slice reported', () => {
  const r = scoreGuess({ data, ap: 0.0, p: [3, 3], key: 'A', maxPts: 40 });
  assert.equal(r.dAp, 1);
  assert.equal(r.pts, 20);
  assert.equal(r.slice.bregma, 1.0);
  assert.equal(r.guessSlice.bregma, 0.0);
  assert.deepEqual(r.q, [3, 3]);
});

test('beyond falloff scores 0', () => {
  const r = scoreGuess({ data, ap: -2.0, p: [3, 3], key: 'A', maxPts: 25 });
  assert.equal(r.pts, 0);
});

test('3D distance combines AP and in-plane (3-4-5)', () => {
  const d = { ...data, scoring: { falloffMm: 10 } };
  const r = scoreGuess({ data: d, ap: 0.0, p: [8, 3], key: 'A', maxPts: 10 }); // in-plane 3, AP 1 -> sqrt(10)
  assert.ok(Math.abs(r.dist3 - Math.sqrt(10)) < 1e-9);
});

test('closest point is searched across all slices containing the target', () => {
  const d = {
    ...data,
    slices: [
      { bregma: 2.0, outline: [], regions: [{ structure: 'A', polygons: [sq(20, 20, 4)] }] },
      { bregma: 1.0, outline: [], regions: [{ structure: 'A', polygons: [sq(1, 1, 4)] }] },
      { bregma: 0.0, outline: [], regions: [] },
    ],
  };
  const r = scoreGuess({ data: d, ap: 2.0, p: [3, 3], key: 'A', maxPts: 40 });
  assert.equal(r.slice.bregma, 1.0); // 1 mm AP away beats ~24 mm in-plane away
  assert.equal(r.dist3, 1);
});

// Integration: every structure in the shipped data is hittable at its peak slice.
// Override the file with DATA=path/to/slices.json
test('every structure scores full points clicking one of its vertices at its peak AP', () => {
  const d = JSON.parse(readFileSync(process.env.DATA ?? 'public/slices.json', 'utf8'));
  for (const [key, s] of Object.entries(d.structures)) {
    const ap = s.peak ?? (s.apRange[0] + s.apRange[1]) / 2;
    const slice = d.slices.reduce((a, b) => (Math.abs(b.bregma - ap) < Math.abs(a.bregma - ap) ? b : a));
    const region = slice.regions.find((r) => r.structure === key);
    assert.ok(region, `${key} missing on slice ${slice.bregma}`);
    const r = scoreGuess({ data: d, ap: slice.bregma, p: region.polygons[0][0], key, maxPts: 40 });
    assert.equal(r.pts, 40, key);
    assert.equal(r.hit, true, key);
  }
});
