import test from 'node:test';
import assert from 'node:assert/strict';
import { sideProfile, extentAt } from '../src/sidemap.js';

const ring = (top, bot) => [[0, top], [10, top], [10, bot], [0, bot]];
const data = {
  meta: { unitUm: 100 }, // 1 unit = 0.1 mm
  slices: [
    { bregma: 1, outline: [ring(20, 80)] },
    { bregma: -1, outline: [ring(10, 70)] },
    { bregma: 0, outline: [ring(15, 75), ring(30, 40)] }, // several rings: extent is over all of them
  ],
};

test('sideProfile: sorted by AP, extents in mm over all outline rings, smoothed', () => {
  const p = sideProfile(data);
  assert.deepEqual(p.pts.map((q) => q.ap), [-1, 0, 1]);
  assert.equal(p.x0, -1);
  assert.equal(p.x1, 1);
  // middle point = average of the three (1.0, 1.5, 2.0 top) = 1.5 mm
  assert.ok(Math.abs(p.pts[1].top - 1.5) < 1e-9);
  assert.ok(p.y0 < p.y1);
});

test('extentAt picks the nearest slice; empty data gives null', () => {
  const p = sideProfile(data);
  assert.equal(extentAt(p, 0.9).ap, 1);
  assert.equal(extentAt(p, -0.4).ap, 0);
  assert.equal(sideProfile({ meta: {}, slices: [{ bregma: 0, outline: [] }] }), null);
});
