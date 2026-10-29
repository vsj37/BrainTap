// BrainTap API (Cloudflare Worker + D1). Static files are served by the assets binding; only /api/* reaches this code.
// Auth: "Authorization: Bearer <playerId>.<secret>". The secret is stored hashed. No cookies -> no CSRF.
import { berlinDay } from '../src/day.js';
import { ROUND_PTS, GROUP_CAP, MAX_GROUPS_JOINED, MAX_GROUPS_OWNED } from '../src/config.js';

const DAY_MS = 864e5;
const dayToMs = (d) => Date.parse(`${d}T00:00:00Z`);
const msToDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const addDays = (d, n) => msToDay(dayToMs(d) + n * DAY_MS);
const weekStart = (d) => addDays(d, -((new Date(dayToMs(d)).getUTCDay() + 6) % 7));
const monthStart = (d) => `${d.slice(0, 7)}-01`;
const monthEnd = (d) => {
  const [y, m] = d.split('-').map(Number);
  return msToDay(Date.UTC(y, m, 1) - DAY_MS);
};
const isDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && msToDay(dayToMs(s)) === s;

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const rand = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));
const sha = async (s) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
const CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
const inviteCode = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');

class HttpError extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export const cleanName = (s, max) => {
  if (typeof s !== 'string') return null;
  const t = s.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (t.length < 2 || [...t].length > max) return null;
  if (/[\p{C}<>]/u.test(t)) return null; // control/format chars, angle brackets
  return t;
};

async function body(req) {
  try {
    const t = await req.text();
    if (t.length > 4000) throw 0;
    const v = JSON.parse(t || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch { throw new HttpError(400, 'Bad request body.'); }
}

async function authed(req, env) {
  const m = /^Bearer ([0-9a-f]{16})\.([0-9a-f]{48})$/.exec(req.headers.get('authorization') || '');
  if (!m) throw new HttpError(401, 'Not signed in.');
  const row = await env.DB.prepare('SELECT id, username, key_hash, created FROM players WHERE id = ?').bind(m[1]).first();
  const h = await sha(m[2]);
  if (!row || row.key_hash !== h) throw new HttpError(401, 'Invalid recovery key.');
  return row;
}

const me = (p) => ({ id: p.id, username: p.username, created: p.created });

function validResult(day, b) {
  const { scores, maxes } = b;
  if (!Array.isArray(scores) || !Array.isArray(maxes) || scores.length !== ROUND_PTS.length || maxes.length !== ROUND_PTS.length) return null;
  for (let i = 0; i < ROUND_PTS.length; i++) {
    if (maxes[i] !== ROUND_PTS[i]) return null;
    if (!Number.isInteger(scores[i]) || scores[i] < 0 || scores[i] > maxes[i]) return null;
  }
  const targets = Array.isArray(b.targets) ? b.targets.slice(0, 3).map((t) => String(t).slice(0, 24)) : [];
  return { scores, maxes, targets, total: scores.reduce((a, c) => a + c, 0) };
}

async function myGroupIds(env, pid) {
  const { results } = await env.DB.prepare('SELECT group_id FROM members WHERE player_id = ?').bind(pid).all();
  return results.map((r) => r.group_id);
}

async function groupSummary(env, g) {
  const c = await env.DB.prepare('SELECT COUNT(*) AS n FROM members WHERE group_id = ?').bind(g.id).first();
  return { id: g.id, name: g.name, members: c.n, cap: GROUP_CAP };
}

function periodRange(period, date) {
  if (period === 'week') return [weekStart(date), addDays(weekStart(date), 6)];
  if (period === 'month') return [monthStart(date), monthEnd(date)];
  return [date, date];
}

async function groupView(env, g, viewer, period, date, today) {
  const [from, to] = periodRange(period, date);
  const mem = (await env.DB.prepare(
    'SELECT p.id, p.username FROM members m JOIN players p ON p.id = m.player_id WHERE m.group_id = ? ORDER BY m.joined, p.id'
  ).bind(g.id).all()).results;
  const mine = await env.DB.prepare('SELECT 1 AS x FROM results WHERE player_id = ? AND day = ?').bind(viewer.id, today).first();
  const unlocked = !!mine; // spoiler rule: today's scores are hidden until the viewer has played today
  const rows = (await env.DB.prepare(
    `SELECT r.player_id, r.day, r.scores, r.total FROM results r JOIN members m ON m.player_id = r.player_id
     WHERE m.group_id = ? AND r.day BETWEEN ? AND ?`
  ).bind(g.id, from, to).all()).results;
  const playedToday = new Set((await env.DB.prepare(
    `SELECT r.player_id FROM results r JOIN members m ON m.player_id = r.player_id WHERE m.group_id = ? AND r.day = ?`
  ).bind(g.id, today).all()).results.map((r) => r.player_id));

  const visible = rows.filter((r) => r.day < today || unlocked);
  const hidden = from <= today && today <= to && !unlocked;
  const by = new Map(mem.map((m) => [m.id, { id: m.id, username: m.username, owner: m.id === g.owner_id, total: 0, games: 0, wins: 0, days: {} }]));
  const perDay = new Map();
  for (const r of visible) {
    const e = by.get(r.player_id);
    if (!e) continue;
    e.total += r.total; e.games += 1;
    e.days[r.day] = { total: r.total, scores: JSON.parse(r.scores) };
    const best = perDay.get(r.day) ?? -1;
    if (r.total > best) perDay.set(r.day, r.total);
  }
  for (const r of visible) if (r.total === perDay.get(r.day) && by.has(r.player_id)) by.get(r.player_id).wins += 1;
  const players = [...by.values()].map((e) => ({
    id: e.id, username: e.username, owner: e.owner, total: e.total, games: e.games, wins: e.wins,
    avg: e.games ? Math.round((e.total / e.games) * 10) / 10 : 0,
    ...(period === 'day' ? { today: e.days[date] ?? null } : {}),
    playedToday: playedToday.has(e.id),
  })).sort((a, b) => b.total - a.total || b.avg - a.avg || a.username.localeCompare(b.username));
  return {
    group: { id: g.id, name: g.name, members: mem.length, cap: GROUP_CAP, owner: g.owner_id === viewer.id, code: g.code },
    period, from, to, today, locked: hidden, players,
  };
}

async function route(req, env, url) {
  const path = url.pathname.replace(/\/+$/, '');
  const method = req.method;
  const today = berlinDay();
  let m;

  if (path === '/api/profile' && method === 'POST') {
    const b = await body(req);
    const username = cleanName(b.username, 20);
    if (!username) throw new HttpError(400, 'Username must be 2-20 characters, no < or >.');
    const id = rand(8), secret = rand(24);
    await env.DB.prepare('INSERT INTO players (id, username, key_hash, created) VALUES (?, ?, ?, ?)').bind(id, username, await sha(secret), today).run();
    return json({ ...me({ id, username, created: today }), key: `${id}.${secret}` }, 201);
  }

  if (path === '/api/groups/preview' && method === 'GET') {
    const code = url.searchParams.get('code') || '';
    const g = /^[a-z0-9]{10}$/.test(code) ? await env.DB.prepare('SELECT * FROM groups WHERE code = ?').bind(code).first() : null;
    if (!g) throw new HttpError(404, 'This invite link is not valid (any more).');
    return json(await groupSummary(env, g));
  }

  const p = await authed(req, env);

  if (path === '/api/me') {
    if (method === 'GET') {
      const rs = (await env.DB.prepare('SELECT day, scores, maxes, targets FROM results WHERE player_id = ? ORDER BY day').bind(p.id).all()).results;
      return json({ ...me(p), results: rs.map((r) => ({ day: r.day, scores: JSON.parse(r.scores), maxes: JSON.parse(r.maxes), targets: JSON.parse(r.targets) })) });
    }
    if (method === 'PATCH') {
      const username = cleanName((await body(req)).username, 20);
      if (!username) throw new HttpError(400, 'Username must be 2-20 characters, no < or >.');
      await env.DB.prepare('UPDATE players SET username = ? WHERE id = ?').bind(username, p.id).run();
      return json({ ...me(p), username });
    }
    if (method === 'DELETE') {
      const owned = (await env.DB.prepare('SELECT id FROM groups WHERE owner_id = ?').bind(p.id).all()).results;
      const st = [];
      for (const g of owned) {
        // hand the group to the longest-standing other member, or delete it if empty
        const next = await env.DB.prepare('SELECT player_id FROM members WHERE group_id = ? AND player_id != ? ORDER BY joined, player_id LIMIT 1').bind(g.id, p.id).first();
        st.push(next ? env.DB.prepare('UPDATE groups SET owner_id = ? WHERE id = ?').bind(next.player_id, g.id) : env.DB.prepare('DELETE FROM groups WHERE id = ?').bind(g.id));
      }
      st.push(env.DB.prepare('DELETE FROM results WHERE player_id = ?').bind(p.id));
      st.push(env.DB.prepare('DELETE FROM members WHERE player_id = ?').bind(p.id));
      st.push(env.DB.prepare('DELETE FROM players WHERE id = ?').bind(p.id));
      await env.DB.batch(st);
      return json({ ok: true });
    }
  }

  if ((m = /^\/api\/results\/(\d{4}-\d{2}-\d{2})$/.exec(path)) && method === 'PUT') {
    if (m[1] !== today) throw new HttpError(400, 'Only today\'s result can be submitted.');
    const r = validResult(m[1], await body(req));
    if (!r) throw new HttpError(400, 'Invalid result.');
    await env.DB.prepare('INSERT OR IGNORE INTO results (player_id, day, scores, maxes, targets, total) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(p.id, m[1], JSON.stringify(r.scores), JSON.stringify(r.maxes), JSON.stringify(r.targets), r.total).run();
    return json({ ok: true });
  }

  if (path === '/api/results' && method === 'POST') { // bulk import of this device's earlier games (past days only)
    const b = await body(req);
    const list = Array.isArray(b.results) ? b.results.slice(0, 400) : [];
    const st = [];
    for (const it of list) {
      if (!isDay(it?.day) || it.day >= today) continue;
      const r = validResult(it.day, it);
      if (r) st.push(env.DB.prepare('INSERT OR IGNORE INTO results (player_id, day, scores, maxes, targets, total) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(p.id, it.day, JSON.stringify(r.scores), JSON.stringify(r.maxes), JSON.stringify(r.targets), r.total));
    }
    if (st.length) await env.DB.batch(st);
    return json({ ok: true, imported: st.length });
  }

  if (path === '/api/groups') {
    if (method === 'GET') {
      const ids = await myGroupIds(env, p.id);
      const out = [];
      for (const id of ids) {
        const g = await env.DB.prepare('SELECT * FROM groups WHERE id = ?').bind(id).first();
        if (g) out.push({ ...(await groupSummary(env, g)), owner: g.owner_id === p.id });
      }
      return json({ groups: out.sort((a, b) => a.name.localeCompare(b.name)) });
    }
    if (method === 'POST') {
      const name = cleanName((await body(req)).name, 30);
      if (!name) throw new HttpError(400, 'Group name must be 2-30 characters, no < or >.');
      const joined = (await myGroupIds(env, p.id)).length;
      if (joined >= MAX_GROUPS_JOINED) throw new HttpError(400, `You can be in at most ${MAX_GROUPS_JOINED} groups.`);
      const owned = await env.DB.prepare('SELECT COUNT(*) AS n FROM groups WHERE owner_id = ?').bind(p.id).first();
      if (owned.n >= MAX_GROUPS_OWNED) throw new HttpError(400, `You can create at most ${MAX_GROUPS_OWNED} groups.`);
      const g = { id: rand(8), name, owner_id: p.id, code: inviteCode(), created: today };
      await env.DB.batch([
        env.DB.prepare('INSERT INTO groups (id, name, owner_id, code, created) VALUES (?, ?, ?, ?, ?)').bind(g.id, g.name, g.owner_id, g.code, g.created),
        env.DB.prepare('INSERT INTO members (group_id, player_id, joined) VALUES (?, ?, ?)').bind(g.id, p.id, today),
      ]);
      return json({ id: g.id, name: g.name, code: g.code }, 201);
    }
  }

  if (path === '/api/groups/join' && method === 'POST') {
    const code = String((await body(req)).code || '');
    const g = /^[a-z0-9]{10}$/.test(code) ? await env.DB.prepare('SELECT * FROM groups WHERE code = ?').bind(code).first() : null;
    if (!g) throw new HttpError(404, 'This invite link is not valid (any more).');
    const already = await env.DB.prepare('SELECT 1 AS x FROM members WHERE group_id = ? AND player_id = ?').bind(g.id, p.id).first();
    if (already) return json({ id: g.id, name: g.name, already: true });
    if ((await myGroupIds(env, p.id)).length >= MAX_GROUPS_JOINED) throw new HttpError(400, `You can be in at most ${MAX_GROUPS_JOINED} groups.`);
    // atomic cap check: the row is only inserted while the group has room
    const r = await env.DB.prepare(
      `INSERT INTO members (group_id, player_id, joined) SELECT ?1, ?2, ?3 WHERE (SELECT COUNT(*) FROM members WHERE group_id = ?1) < ?4`
    ).bind(g.id, p.id, today, GROUP_CAP).run();
    if (!r.meta?.changes) throw new HttpError(409, `This group is full (${GROUP_CAP} members).`);
    return json({ id: g.id, name: g.name }, 201);
  }

  if ((m = /^\/api\/groups\/([0-9a-f]{16})$/.exec(path))) {
    const g = await env.DB.prepare('SELECT * FROM groups WHERE id = ?').bind(m[1]).first();
    const isMember = g && (await env.DB.prepare('SELECT 1 AS x FROM members WHERE group_id = ? AND player_id = ?').bind(g.id, p.id).first());
    if (!g || !isMember) throw new HttpError(404, 'Group not found.');
    if (method === 'GET') {
      const period = ['day', 'week', 'month'].includes(url.searchParams.get('period')) ? url.searchParams.get('period') : 'day';
      let date = url.searchParams.get('date');
      if (!isDay(date) || date > today) date = today;
      return json(await groupView(env, g, p, period, date, today));
    }
    if (method === 'DELETE') {
      if (g.owner_id !== p.id) throw new HttpError(403, 'Only the owner can delete the group.');
      await env.DB.batch([env.DB.prepare('DELETE FROM members WHERE group_id = ?').bind(g.id), env.DB.prepare('DELETE FROM groups WHERE id = ?').bind(g.id)]);
      return json({ ok: true });
    }
  }

  if ((m = /^\/api\/groups\/([0-9a-f]{16})\/leave$/.exec(path)) && method === 'POST') {
    const g = await env.DB.prepare('SELECT * FROM groups WHERE id = ?').bind(m[1]).first();
    if (!g) throw new HttpError(404, 'Group not found.');
    await env.DB.prepare('DELETE FROM members WHERE group_id = ? AND player_id = ?').bind(g.id, p.id).run();
    if (g.owner_id === p.id) {
      const next = await env.DB.prepare('SELECT player_id FROM members WHERE group_id = ? ORDER BY joined, player_id LIMIT 1').bind(g.id).first();
      if (next) await env.DB.prepare('UPDATE groups SET owner_id = ? WHERE id = ?').bind(next.player_id, g.id).run();
      else await env.DB.prepare('DELETE FROM groups WHERE id = ?').bind(g.id).run();
    }
    return json({ ok: true });
  }

  if ((m = /^\/api\/groups\/([0-9a-f]{16})\/members\/([0-9a-f]{16})$/.exec(path)) && method === 'DELETE') {
    const g = await env.DB.prepare('SELECT * FROM groups WHERE id = ?').bind(m[1]).first();
    if (!g || g.owner_id !== p.id) throw new HttpError(403, 'Only the owner can remove members.');
    if (m[2] === p.id) throw new HttpError(400, 'Use "Leave group" instead.');
    await env.DB.prepare('DELETE FROM members WHERE group_id = ? AND player_id = ?').bind(g.id, m[2]).run();
    return json({ ok: true });
  }

  throw new HttpError(404, 'Not found.');
}

export default {
  async fetch(req, env) {
    try {
      return await route(req, env, new URL(req.url));
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: 'Server error.' }, 500);
    }
  },
};
