import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays, emptyProfile, exportCode, loadProfile, mergeProfiles, parseCode, pct, recordResult,
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

test('backup code round-trips, including unicode names', () => {
  const p = { ...withDays(['2026-10-27', '2026-10-28']), name: 'Zoë 🧠' };
  const back = parseCode(exportCode(p));
  assert.equal(back.name, 'Zoë 🧠');
  assert.deepEqual(back.history, p.history);
});

test('imports are validated: bad entries dropped, junk rejected', () => {
  const bad = {
    name: 'x'.repeat(100),
    history: {
      '2026-10-01': full,
      'not-a-date': full,
      '2026-10-02': { scores: [99], maxes: [25] }, // score above max
      '2026-10-03': { scores: [1, 2], maxes: [25] }, // length mismatch
      '2026-10-04': { scores: ['a'], maxes: [25] },
      '2026-13-45': full,
    },
  };
  const code = `BT1.${Buffer.from(JSON.stringify(bad)).toString('base64url')}`;
  const p = parseCode(code);
  assert.deepEqual(Object.keys(p.history), ['2026-10-01']);
  assert.equal(p.name.length, 24);
  assert.throws(() => parseCode('hello'), /backup code/);
  assert.throws(() => parseCode('BT1.@@@'), /damaged/);
});

test('mergeProfiles: union of days, existing wins on conflict', () => {
  const a = recordResult(emptyProfile(new Date('2026-10-05')), '2026-10-01', zero);
  const b = recordResult(recordResult(emptyProfile(new Date('2026-09-01')), '2026-10-01', full), '2026-10-02', full);
  const m = mergeProfiles(a, { ...b, name: 'Bo' });
  assert.deepEqual(Object.keys(m.history).sort(), ['2026-10-01', '2026-10-02']);
  assert.equal(pct(m.history['2026-10-01']), 0);
  assert.equal(m.name, 'Bo');
  assert.equal(m.created, '2026-09-01');
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
