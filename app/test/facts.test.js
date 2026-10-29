import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { REGION_FACTS, factFor } from '../src/facts.js';

const keys = new Set(fs.readFileSync(new URL('../tools/regions.csv', import.meta.url), 'utf8').split('\n').slice(1).map((l) => l.split(',')[0]).filter(Boolean));

test('every region fact belongs to a real region and is short', () => {
  for (const [k, t] of Object.entries(REGION_FACTS)) {
    assert.ok(keys.has(k), `${k} is not in regions.csv`);
    assert.ok(t.length > 20 && t.length <= 260, `${k}: length ${t.length}`);
  }
});

test('factFor: region fact when known, otherwise a deterministic pun or story', () => {
  assert.equal(factFor('CA1').kind, 'Fun fact');
  const a = factFor('LRN', '2026-10-29|1');
  assert.deepEqual(a, factFor('LRN', '2026-10-29|1'));
  assert.ok(['Neuro pun', 'Neuroscientist story'].includes(a.kind));
  const kinds = new Set(Array.from({ length: 40 }, (_, i) => factFor('LRN', `d${i}`).kind));
  assert.equal(kinds.size, 2);
});
