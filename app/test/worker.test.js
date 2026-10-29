import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../worker/index.js';
import { GROUP_CAP } from '../src/config.js';
import { berlinDay } from '../src/day.js';

// Minimal D1 shim over node:sqlite
function makeDB() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(fs.readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8'));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...args).changes) } }),
  });
  return {
    prepare: (sql) => stmt(sql),
    batch: async (list) => {
      db.exec('BEGIN');
      try { for (const s of list) await s.run(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    raw: db,
  };
}
const env = { DB: makeDB() };
const today = berlinDay();
const addD = (d, n) => new Date(Date.parse(d) + n * 864e5).toISOString().slice(0, 10);

async function call(method, path, { key, body } = {}) {
  const headers = {};
  if (key) headers.authorization = `Bearer ${key}`;
  const res = await worker.fetch(new Request(`https://x.test${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), env);
  return { status: res.status, data: await res.json() };
}
const mk = async (username) => (await call('POST', '/api/profile', { body: { username } })).data;
const res = (scores) => ({ scores, maxes: [25, 35, 40] });
const put = (key, day, scores) => call('PUT', `/api/results/${day}`, { key, body: res(scores) });

test('profile: create, validation, auth', async () => {
  const a = await mk('Ada');
  assert.match(a.key, /^[0-9a-f]{16}\.[0-9a-f]{48}$/);
  assert.equal((await call('POST', '/api/profile', { body: { username: '<b>x</b>' } })).status, 400);
  assert.equal((await call('POST', '/api/profile', { body: { username: 'x' } })).status, 400);
  assert.equal((await call('GET', '/api/me')).status, 401);
  assert.equal((await call('GET', '/api/me', { key: a.id + '.' + '0'.repeat(48) })).status, 401);
  assert.equal((await call('GET', '/api/me', { key: a.key })).data.username, 'Ada');
  assert.equal((await call('PATCH', '/api/me', { key: a.key, body: { username: 'Ada L' } })).data.username, 'Ada L');
});

test('results: validation, today only, first write wins', async () => {
  const a = await mk('Res');
  assert.equal((await put(a.key, addD(today, -1), [1, 2, 3])).status, 400);
  assert.equal((await put(a.key, today, [26, 0, 0])).status, 400);
  assert.equal((await put(a.key, today, [1.5, 0, 0])).status, 400);
  assert.equal((await call('PUT', `/api/results/${today}`, { key: a.key, body: { scores: [1, 2, 3], maxes: [10, 10, 10] } })).status, 400);
  assert.equal((await put(a.key, today, [25, 35, 40])).status, 200);
  assert.equal((await put(a.key, today, [0, 0, 0])).status, 200); // ignored
  const me = (await call('GET', '/api/me', { key: a.key })).data;
  assert.deepEqual(me.results.map((r) => r.scores), [[25, 35, 40]]);
  const imp = await call('POST', '/api/results', { key: a.key, body: { results: [{ day: addD(today, -2), ...res([1, 2, 3]) }, { day: today, ...res([0, 0, 0]) }, { day: 'bad', ...res([0, 0, 0]) }] } });
  assert.equal(imp.data.imported, 1);
});

test('groups: create, invite preview, join, cap, leave, ownership', async () => {
  const o = await mk('Owner');
  const g = (await call('POST', '/api/groups', { key: o.key, body: { name: 'Lab' } })).data;
  assert.match(g.code, /^[a-z0-9]{10}$/);
  const pre = await call('GET', `/api/groups/preview?code=${g.code}`);
  assert.deepEqual([pre.data.name, pre.data.members, pre.data.cap], ['Lab', 1, GROUP_CAP]);
  assert.equal((await call('GET', '/api/groups/preview?code=nope')).status, 404);

  const b = await mk('Bob');
  assert.equal((await call('POST', '/api/groups/join', { key: b.key, body: { code: g.code } })).status, 201);
  assert.equal((await call('POST', '/api/groups/join', { key: b.key, body: { code: g.code } })).data.already, true);
  // non-member cannot read
  const out = await mk('Out');
  assert.equal((await call('GET', `/api/groups/${g.id}`, { key: out.key })).status, 404);
  // fill to cap
  for (let i = 0; i < GROUP_CAP - 2; i++) {
    const p = await mk(`P${i}`);
    assert.equal((await call('POST', '/api/groups/join', { key: p.key, body: { code: g.code } })).status, 201);
  }
  const full = await call('POST', '/api/groups/join', { key: out.key, body: { code: g.code } });
  assert.equal(full.status, 409);
  assert.equal((await call('GET', `/api/groups/preview?code=${g.code}`)).data.members, GROUP_CAP);
  // member removal / leave / handover
  assert.equal((await call('DELETE', `/api/groups/${g.id}/members/${b.id}`, { key: b.key })).status, 403);
  assert.equal((await call('POST', `/api/groups/${g.id}/leave`, { key: o.key })).status, 200);
  const view = (await call('GET', `/api/groups/${g.id}`, { key: b.key })).data;
  assert.equal(view.group.members, GROUP_CAP - 1);
  assert.equal(view.players.filter((x) => x.owner).length, 1); // ownership handed to a remaining member
  assert.equal((await call('POST', '/api/groups/join', { key: out.key, body: { code: g.code } })).status, 201); // room again
});

test('spoilers: today hidden until the viewer has played; past days always visible', async () => {
  const a = await mk('Aa'), b = await mk('Bb');
  const g = (await call('POST', '/api/groups', { key: a.key, body: { name: 'Spoil' } })).data;
  await call('POST', '/api/groups/join', { key: b.key, body: { code: g.code } });
  await call('POST', '/api/results', { key: a.key, body: { results: [{ day: addD(today, -1), ...res([20, 20, 20]) }] } });
  await put(a.key, today, [25, 35, 40]);

  let v = (await call('GET', `/api/groups/${g.id}?period=day`, { key: b.key })).data; // B has not played today
  assert.equal(v.locked, true);
  const ra = v.players.find((p) => p.id === a.id);
  assert.equal(ra.playedToday, true);
  assert.equal(ra.today, null);
  assert.equal(ra.total, 0);
  v = (await call('GET', `/api/groups/${g.id}?period=day&date=${addD(today, -1)}`, { key: b.key })).data;
  assert.equal(v.players.find((p) => p.id === a.id).today.total, 60);
  v = (await call('GET', `/api/groups/${g.id}?period=week`, { key: b.key })).data;
  assert.ok(!JSON.stringify(v).includes('"total":100'));

  await put(b.key, today, [0, 0, 0]);
  v = (await call('GET', `/api/groups/${g.id}?period=day`, { key: b.key })).data;
  assert.equal(v.locked, false);
  assert.equal(v.players[0].id, a.id);
  assert.equal(v.players[0].today.total, 100);
  assert.deepEqual(v.players[0].today.scores, [25, 35, 40]);
  v = (await call('GET', `/api/groups/${g.id}?period=month`, { key: b.key })).data;
  const sa = v.players.find((p) => p.id === a.id);
  assert.ok(sa.games >= 1 && sa.wins >= 1);
});

test('delete profile removes results and memberships; ownership transfers', async () => {
  const a = await mk('Del'), b = await mk('Keep');
  const g = (await call('POST', '/api/groups', { key: a.key, body: { name: 'Gone' } })).data;
  await call('POST', '/api/groups/join', { key: b.key, body: { code: g.code } });
  await put(a.key, today, [1, 1, 1]);
  assert.equal((await call('DELETE', '/api/me', { key: a.key })).status, 200);
  assert.equal((await call('GET', '/api/me', { key: a.key })).status, 401);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) c FROM results WHERE player_id = ?').get(a.id).c, 0);
  const v = (await call('GET', `/api/groups/${g.id}`, { key: b.key })).data;
  assert.equal(v.players.length, 1);
  assert.equal(v.group.owner, true);
  assert.equal((await call('DELETE', '/api/me', { key: b.key })).status, 200);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) c FROM groups WHERE id = ?').get(g.id).c, 0); // empty group removed
});
