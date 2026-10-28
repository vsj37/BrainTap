import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays, emptyProfile, loadProfile, mergeHistory, pct, recordResult,
  saveProfile, saveProgress, series, streaks, summary, weekStart,
} from '../src/store.js';

const full = { scores: [25, 35, 40], maxes: [25, 35, 40], targets: ['A', 'B', 'C'] };
const zero = { scores: [0, 0, 0], maxes: [25, 35, 40], targets: ['A', 'B', 'C'] };
const withDays = (days, entry = full) => days.reduce((p, d) => recordResult(p, d, entry), emptyProfile(new Date('2026-10-01')));

test('date helpers (UTC, Monday weeks)', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(weekStart('2026-10-28'), '2026-10-26'); // Wednesday -> Monday
  assert.equal(weekStart('2026-10-26'), '2026-10-26');
  assert.equal(weekStart('2026-11-01'), '2026-10-26'); // Sunday belongs to the week before
});

test('recordResult: one play per day, clears progress', () => {
  let p = saveProgress(emptyProfile(), '2026-10-28', [10, 20]);
  assert.deepEqual(p.progress, { day: '2026-10-28', scores: [10, 20] });
  p = recordResult(p, '2026-10-28', full);
  assert.equal(p.progress, null);
  const again = recordResult(p, '2026-10-28', zero);
  assert.equal(again, p);
  assert.equal(pct(p.history['2026-10-28']), 100);
  assert.throws(() => recordResult(p, 'nope', full));
});

test('streaks: current stays alive until today is over; best tracks the longest run', () => {
  const h = withDays(['2026-10-20', '2026-10-21', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27']).history;
  assert.deepEqual(streaks(h, '2026-10-28'), { current: 4, best: 4 }); // today not played yet
  const h2 = withDays(['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28']).history;
  assert.deepEqual(streaks(h2, '2026-10-28'), { current: 5, best: 5 });
  assert.deepEqual(streaks(h, '2026-10-30'), { current: 0, best: 4 }); // missed a day
  assert.deepEqual(streaks({}, '2026-10-28'), { current: 0, best: 0 });
});

test('summary', () => {
  assert.deepEqual(summary({}), { played: 0, avg: null, best: null });
  let p = recordResult(emptyProfile(), '2026-10-27', zero);
  p = recordResult(p, '2026-10-28', full);
  assert.deepEqual(summary(p.history), { played: 2, avg: 50, best: 100 });
});

test('series: days, weeks (Monday), months (incl. year boundary)', () => {
  let p = recordResult(emptyProfile(), '2026-10-20', full); // week of 10-19
  p = recordResult(p, '2026-10-27', zero); // week of 10-26
  p = recordResult(p, '2026-10-28', full); // week of 10-26
  const days = series(p.history, 'day', '2026-10-28', 3);
  assert.deepEqual(days.map((d) => [d.key, d.avg]), [['2026-10-26', null], ['2026-10-27', 0], ['2026-10-28', 100]]);
  const weeks = series(p.history, 'week', '2026-10-28', 2);
  assert.deepEqual(weeks, [{ key: '2026-10-19', count: 1, avg: 100 }, { key: '2026-10-26', count: 2, avg: 50 }]);
  const months = series(p.history, 'month', '2026-10-28', 2);
  assert.deepEqual(months.map((m) => [m.key, m.count, m.avg]), [['2026-09-01', 0, null], ['2026-10-01', 3, 67]]);
  assert.deepEqual(series({}, 'month', '2026-01-15', 2).map((m) => m.key), ['2025-12-01', '2026-01-01']);
});

test('mergeHistory: union of days, local wins, invalid entries dropped', () => {
  const local = { '2026-10-01': zero };
  const incoming = {
    '2026-10-01': full,
    '2026-10-02': full,
    'not-a-date': full,
    '2026-10-03': { scores: [99], maxes: [25] }, // score above max
    '2026-10-04': { scores: [1, 2], maxes: [25] }, // length mismatch
    '2026-13-45': full,
  };
  const m = mergeHistory(local, incoming);
  assert.deepEqual(Object.keys(m).sort(), ['2026-10-01', '2026-10-02']);
  assert.equal(pct(m['2026-10-01']), 0);
  assert.equal(pct(m['2026-10-02']), 100);
  assert.deepEqual(mergeHistory({}, null), {});
});

test('persistence: round-trip, corrupt data, unavailable storage', () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  const p = saveProgress(withDays(['2026-10-27']), '2026-10-28', [10]);
  assert.equal(saveProfile(storage, p), true);
  const loaded = loadProfile(storage);
  assert.deepEqual(loaded.history, p.history);
  assert.deepEqual(loaded.progress, { day: '2026-10-28', scores: [10] });

  mem.set([...mem.keys()][0], '{not json');
  assert.deepEqual(loadProfile(storage).history, {});
  const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
  assert.deepEqual(loadProfile(broken).history, {});
  assert.equal(saveProfile(broken, p), false);
});
