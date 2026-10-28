// Groups: list, create, invite/join, and the leaderboard page. No spoilers: the server hides today's scores
// until you have played today, so the UI only has to show what it receives.
// ctx: { api, getCloud, today(), go(hash), account }  (account = { form(opts) } from main)
import { h, tier } from './ui.js';
import { GROUP_CAP, ROUND_PTS } from './config.js';
import { CODE_RE, parseInvite } from './api.js';

const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const fmt = (d, opts) => new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, { timeZone: 'UTC', ...opts });
const inviteUrl = (code) => `${location.origin}${location.pathname}#join/${code}`;
const PERIODS = [['day', 'Today'], ['week', 'This week'], ['month', 'This month']];

function periodTitle(v, period) {
  if (period === 'day') return v.from === v.today ? 'Today' : fmt(v.from, { weekday: 'short', day: 'numeric', month: 'short' });
  if (period === 'week') return v.from <= v.today && v.today <= v.to ? 'This week' : `${fmt(v.from, { day: 'numeric', month: 'short' })} – ${fmt(v.to, { day: 'numeric', month: 'short' })}`;
  return v.from.slice(0, 7) === v.today.slice(0, 7) ? 'This month' : fmt(v.from, { month: 'long', year: 'numeric' });
}

const nameCell = (p, meId) => h('td', { class: 'who' }, p.username, p.owner && h('span', { class: 'crown', title: 'Group owner', 'aria-label': 'owner' }, ' 👑'), p.id === meId && h('span', { class: 'you' }, ' (you)'));

export function createGroups(ctx) {
  const needProfile = (root, why, then) => {
    root.replaceChildren(
      h('h1', {}, 'Groups'),
      h('p', {}, why),
      h('div', { class: 'card' }, h('h2', {}, 'Create a profile first'), ctx.account.form({ onDone: then })),
    );
  };

  // ---------- my groups ----------
  async function renderList(root) {
    if (!ctx.getCloud()) return needProfile(root, 'Play with friends: see everyone\'s scores in a private group, joined by invite link.', () => renderList(root));
    root.replaceChildren(h('h1', {}, 'My groups'), h('p', { class: 'msg' }, 'Loading…'));
    let groups;
    try { groups = (await ctx.api.groups()).groups; } catch (err) {
      return root.replaceChildren(h('h1', {}, 'My groups'), h('p', { class: 'msg' }, err.message), h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => renderList(root) }, 'Try again'));
    }
    const msg = h('p', { class: 'msg', role: 'status' });
    const name = h('input', { type: 'text', maxlength: '30', placeholder: 'Group name', 'aria-label': 'Group name' });
    const create = h('button', { type: 'button', class: 'btn btn-primary' }, 'Create group');
    create.addEventListener('click', async () => {
      create.disabled = true;
      try { const g = await ctx.api.createGroup(name.value); ctx.go(`#g/${g.id}`); } catch (err) { msg.textContent = err.message; create.disabled = false; }
    });
    const link = h('input', { type: 'text', placeholder: 'Paste invite link', 'aria-label': 'Invite link or code' });
    const join = h('button', { type: 'button', class: 'btn btn-ghost' }, 'Join');
    join.addEventListener('click', () => {
      const code = parseInvite(link.value);
      if (code && CODE_RE.test(code)) ctx.go(`#join/${code}`); else msg.textContent = 'That does not look like an invite link.';
    });
    root.replaceChildren(
      h('h1', {}, 'My groups'),
      groups.length
        ? h('ul', { class: 'group-list' }, groups.map((g) => h('li', {}, h('a', { href: `#g/${g.id}` }, h('span', { class: 'gname' }, g.name, g.owner && h('span', { class: 'crown' }, ' 👑')), h('span', { class: 'gcount' }, `${g.members}/${g.cap} members`)))))
        : h('p', { class: 'empty' }, 'You are not in any group yet. Create one and send the invite link to your friends.'),
      h('div', { class: 'card stack' }, h('h2', {}, 'Create a group'), h('div', { class: 'inline' }, name, create)),
      h('div', { class: 'card stack' }, h('h2', {}, 'Join a group'), h('div', { class: 'inline' }, link, join)),
      msg,
    );
  }

  // ---------- invite link ----------
  async function renderJoin(root, code) {
    root.replaceChildren(h('h1', {}, 'Group invitation'), h('p', { class: 'msg' }, 'Loading…'));
    let info;
    try { info = CODE_RE.test(code) ? await ctx.api.preview(code) : null; if (!info) throw new Error('This invite link is not valid (any more).'); } catch (err) {
      return root.replaceChildren(h('h1', {}, 'Group invitation'), h('p', {}, err.message), h('a', { class: 'btn btn-ghost', href: '#groups' }, 'My groups'));
    }
    const full = info.members >= info.cap;
    const msg = h('p', { class: 'msg', role: 'status' });
    const doJoin = async (btn) => {
      btn && (btn.disabled = true);
      try { const g = await ctx.api.join(code); ctx.go(`#g/${g.id}`); } catch (err) { msg.textContent = err.message; btn && (btn.disabled = false); }
    };
    const body = [h('h1', {}, 'Group invitation'), h('div', { class: 'card' }, h('h2', {}, info.name), h('p', {}, `${info.members}/${info.cap} members`))];
    if (full) body.push(h('p', {}, `This group is full (${info.cap} members).`));
    else if (ctx.getCloud()) {
      const b = h('button', { type: 'button', class: 'btn btn-primary' }, 'Join group');
      b.addEventListener('click', () => doJoin(b));
      body.push(h('p', { class: 'small' }, 'Members of this group will see your username and your scores.'), b);
    } else {
      body.push(h('p', {}, 'Choose a username to join. No login or email needed.'), ctx.account.form({ cta: 'Create profile & join', onDone: () => doJoin(null) }));
    }
    body.push(msg);
    root.replaceChildren(...body);
  }

  // ---------- one group ----------
  const state = new Map(); // group id -> { period, date }
  async function renderGroup(root, id) {
    if (!ctx.getCloud()) return needProfile(root, 'Create a profile to see this group.', () => renderGroup(root, id));
    const st = state.get(id) ?? { period: 'day', date: null };
    state.set(id, st);
    let v;
    try { v = await ctx.api.group(id, st.period, st.date); } catch (err) {
      return root.replaceChildren(h('a', { class: 'link', href: '#groups' }, '‹ My groups'), h('p', { class: 'msg' }, err.message));
    }
    const me = ctx.getCloud().id;
    const rerender = () => renderGroup(root, id);
    const msg = h('p', { class: 'msg', role: 'status' });

    const head = h(
      'div',
      { class: 'ghead' },
      h('a', { class: 'link', href: '#groups' }, '‹ My groups'),
      h('h1', {}, v.group.name, v.group.owner && h('span', { class: 'crown' }, ' 👑')),
      h('p', { class: 'gcount' }, `${v.group.members}/${v.group.cap} members`),
    );

    const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Period' }, PERIODS.map(([p, label]) => h('button', { type: 'button', 'aria-pressed': String(st.period === p), onclick: () => { st.period = p; st.date = null; rerender(); } }, label)));
    const atNow = v.to >= v.today;
    const nav = h(
      'div',
      { class: 'pnav' },
      h('button', { type: 'button', class: 'nudge', 'aria-label': 'Previous period', onclick: () => { st.date = addDays(v.from, -1); rerender(); } }, '‹'),
      h('b', {}, periodTitle(v, st.period)),
      h('button', { type: 'button', class: 'nudge', 'aria-label': 'Next period', disabled: atNow, onclick: () => { st.date = addDays(v.to, 1); rerender(); } }, '›'),
    );

    const players = v.players.slice();
    let table;
    if (st.period === 'day') {
      players.sort((a, b) => (b.today?.total ?? -1) - (a.today?.total ?? -1) || Number(b.playedToday) - Number(a.playedToday) || a.username.localeCompare(b.username));
      table = h(
        'table',
        { class: 'table' },
        h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Player'), h('th', { class: 'num' }, 'R1'), h('th', { class: 'num' }, 'R2'), h('th', { class: 'num' }, 'R3'), h('th', { class: 'num' }, 'Total'))),
        h('tbody', {}, players.map((p, i) => {
          const t = p.today;
          const hiddenToday = v.locked && v.from === v.today && p.playedToday;
          const cells = t
            ? [...t.scores.map((s, r) => h('td', { class: `num sc sc-${tier(s, ROUND_PTS[r] ?? 1)}` }, String(s))), h('td', { class: 'num tot' }, String(t.total))]
            : [h('td', { class: 'num dim', colspan: '3' }, hiddenToday ? 'played · hidden' : '–'), h('td', { class: 'num tot dim' }, hiddenToday ? '🔒' : '–')];
          return h('tr', { class: p.id === me ? 'me' : '' }, h('td', { class: 'rank' }, t ? String(i + 1) : ''), nameCell(p, me), ...cells);
        })),
      );
    } else {
      table = h(
        'table',
        { class: 'table' },
        h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Player'), h('th', { class: 'num' }, 'Total'), h('th', { class: 'num' }, 'Games'), h('th', { class: 'num' }, 'Avg'), h('th', { class: 'num' }, 'Wins'))),
        h('tbody', {}, players.map((p, i) => h('tr', { class: p.id === me ? 'me' : '' },
          h('td', { class: 'rank' }, p.games ? String(i + 1) : ''), nameCell(p, me),
          h('td', { class: 'num tot' }, String(p.total)), h('td', { class: 'num' }, String(p.games)), h('td', { class: 'num' }, p.games ? p.avg.toFixed(1) : '–'), h('td', { class: 'num' }, String(p.wins))))),
      );
    }

    const lockNote = v.locked && h('div', { class: 'callout' }, h('b', {}, 'No spoilers. '), `Today's scores unlock once you have played today's slide.`, ' ', h('a', { href: '#' }, 'Play now'));

    const invite = h('div', { class: 'card stack' }, h('h2', {}, 'Invite friends'), h('p', { class: 'small' }, `Anyone with this link can join (up to ${GROUP_CAP} members).`));
    const linkIn = h('input', { type: 'text', readonly: true, value: inviteUrl(v.group.code), 'aria-label': 'Invite link' });
    linkIn.addEventListener('focus', () => linkIn.select());
    const copy = h('button', { type: 'button', class: 'btn btn-primary' }, 'Copy invite link');
    copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(inviteUrl(v.group.code)); copy.textContent = 'Copied'; } catch { linkIn.select(); msg.textContent = 'Copy the link from the box.'; } });
    invite.append(h('div', { class: 'inline' }, linkIn, copy));

    const act = (fn, after) => async () => { try { await fn(); after(); } catch (err) { msg.textContent = err.message; } };
    const leave = h('button', { type: 'button', class: 'btn btn-ghost', onclick: act(async () => { if (!confirm('Leave this group?')) throw new Error(''); await ctx.api.leave(id); }, () => ctx.go('#groups')) }, 'Leave group');
    const manage = v.group.owner && h(
      'details',
      { class: 'more' },
      h('summary', {}, 'Manage members'),
      h('ul', { class: 'members' }, v.players.filter((p) => p.id !== me).map((p) => h('li', {}, h('span', {}, p.username), h('button', { type: 'button', class: 'btn btn-ghost small-btn', onclick: act(async () => { if (!confirm(`Remove ${p.username} from the group?`)) throw new Error(''); await ctx.api.removeMember(id, p.id); }, rerender) }, 'Remove')))),
      h('button', { type: 'button', class: 'btn btn-ghost danger', onclick: act(async () => { if (!confirm('Delete this group for everyone?')) throw new Error(''); await ctx.api.deleteGroup(id); }, () => ctx.go('#groups')) }, 'Delete group'),
    );

    root.replaceChildren(...[head, seg, nav, lockNote, h('div', { class: 'table-wrap' }, table), invite, h('div', { class: 'btns' }, leave), manage, msg].filter(Boolean));
  }

  return { renderList, renderJoin, renderGroup };
}
