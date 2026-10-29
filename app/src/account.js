// Profile UI: create (username only, no login), sign in with a recovery key, rename, export, delete.
// ctx: { api, getCloud(), setCloud(c|null), history(), importHistory(h), sync(), rerender(), volatile }
import { h } from './ui.js';
import { KEY_RE } from './api.js';
import { MIN_AGE } from './config.js';

const field = (label, input) => h('label', { class: 'field' }, h('span', {}, label), input);

export function accountForm(ctx, { onDone, cta = 'Create profile' } = {}) {
  const name = h('input', { type: 'text', maxlength: '20', autocomplete: 'nickname', placeholder: 'e.g. NeuroNinja', required: true });
  const agree = h('input', { type: 'checkbox', id: 'agree' });
  const msg = h('p', { class: 'msg', role: 'status' });
  const create = h('button', { type: 'submit', class: 'btn btn-primary' }, cta);
  const form = h(
    'form',
    { class: 'stack' },
    field('Choose a username (shown to people in your groups)', name),
    h('label', { class: 'check' }, agree, h('span', {}, `I am at least ${MIN_AGE} and have read the `, h('a', { href: '#privacy' }, 'privacy notice'), '. No email or password needed.')),
    create,
    msg,
  );
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';
    if (!agree.checked) { msg.textContent = 'Please tick the box to continue.'; return; }
    create.disabled = true;
    try {
      const p = await ctx.api.createProfile(name.value);
      ctx.setCloud({ id: p.id, username: p.username, key: p.key });
      await ctx.sync();
      onDone?.();
    } catch (err) {
      msg.textContent = err.message;
      create.disabled = false;
    }
  });
  return form;
}

export function signInForm(ctx, { onDone } = {}) {
  const key = h('input', { type: 'text', autocomplete: 'off', spellcheck: 'false', placeholder: 'Paste your recovery key', 'aria-label': 'Recovery key' });
  const msg = h('p', { class: 'msg', role: 'status' });
  const go = h('button', { type: 'button', class: 'btn btn-ghost' }, 'Sign in with key');
  go.addEventListener('click', async () => {
    const k = key.value.trim().toLowerCase();
    if (!KEY_RE.test(k)) { msg.textContent = 'That does not look like a recovery key.'; return; }
    go.disabled = true;
    const prev = ctx.getCloud();
    try {
      ctx.setCloud({ id: k.split('.')[0], username: '', key: k });
      const me = await ctx.api.me();
      ctx.importHistory(Object.fromEntries(me.results.map((r) => [r.day, { scores: r.scores, maxes: r.maxes, targets: r.targets }])));
      ctx.setCloud({ id: me.id, username: me.username, key: k });
      await ctx.sync();
      onDone?.();
    } catch (err) {
      ctx.setCloud(prev);
      msg.textContent = err.status === 401 ? 'That recovery key was not accepted.' : err.message;
      go.disabled = false;
    }
  });
  return h('div', { class: 'stack' }, key, go, msg);
}

function download(name, obj) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function accountPanel(ctx) {
  const c = ctx.getCloud();
  const msg = h('p', { class: 'msg', role: 'status' });
  const rename = h('input', { type: 'text', maxlength: '20', value: c.username, 'aria-label': 'Username' });
  const keyBox = h('div', { hidden: true, class: 'keybox' });
  const wrap = (fn) => async () => {
    msg.textContent = '';
    try { await fn(); } catch (err) { msg.textContent = err.message; }
  };

  const saveName = wrap(async () => {
    const me = await ctx.api.rename(rename.value);
    ctx.setCloud({ ...c, username: me.username });
    ctx.rerender();
  });
  const showKey = h('button', { type: 'button', class: 'btn btn-ghost' }, 'Show recovery key');
  showKey.addEventListener('click', () => {
    keyBox.hidden = !keyBox.hidden;
    showKey.textContent = keyBox.hidden ? 'Show recovery key' : 'Hide recovery key';
  });
  const copyKey = h('button', { type: 'button', class: 'btn btn-ghost' }, 'Copy key');
  copyKey.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(c.key); copyKey.textContent = 'Copied'; } catch { msg.textContent = 'Select the key above and copy it.'; }
  });
  keyBox.append(h('code', { class: 'key' }, c.key), copyKey, h('p', { class: 'small' }, 'Keep this private: anyone with it can use your profile. Save it somewhere safe. If you lose it and clear this browser, the profile cannot be recovered.'));

  const exportData = wrap(async () => {
    const [me, g] = await Promise.all([ctx.api.me(), ctx.api.groups()]);
    download('braintap-my-data.json', { exported: new Date().toISOString(), profile: { id: me.id, username: me.username, created: me.created }, results: me.results, groups: g.groups.map((x) => ({ name: x.name, members: x.members, owner: x.owner })) });
  });
  const signOut = () => { ctx.setCloud(null); ctx.rerender(); };
  const del = wrap(async () => {
    if (!confirm('Delete your profile from the server? Your scores and group memberships are removed for good. Stats saved in this browser stay.')) return;
    await ctx.api.deleteMe();
    ctx.setCloud(null);
    ctx.rerender();
  });

  return h(
    'div',
    { class: 'stack' },
    h('p', {}, 'Signed in as ', h('b', {}, c.username || 'unknown'), '. Your results are saved to your profile and shown to people in your groups.'),
    h('div', { class: 'inline' }, rename, h('button', { type: 'button', class: 'btn btn-ghost', onclick: saveName }, 'Rename')),
    h('div', { class: 'btns' }, showKey, h('button', { type: 'button', class: 'btn btn-ghost', onclick: exportData }, 'Download my data')),
    keyBox,
    h('div', { class: 'btns' }, h('button', { type: 'button', class: 'btn btn-ghost', onclick: signOut }, 'Sign out on this device'), h('button', { type: 'button', class: 'btn btn-ghost danger', onclick: del }, 'Delete my profile')),
    msg,
  );
}

// Whole "Profile" block for the Stats page.
export function profileSection(ctx) {
  const c = ctx.getCloud();
  if (c) return h('section', { class: 'section' }, h('h2', {}, 'Your profile'), accountPanel(ctx));
  return h(
    'section',
    { class: 'section' },
    h('h2', {}, 'Create a profile'),
    h('p', {}, 'Optional. A username (no login, no email) lets you keep your scores online and join groups with friends.'),
    ctx.volatile && h('p', { class: 'small' }, 'This browser is not letting the page save anything, so stats are lost when you close the tab.'),
    accountForm(ctx, { onDone: ctx.rerender }),
    h('details', { class: 'more' }, h('summary', {}, 'I already have a recovery key'), signInForm(ctx, { onDone: ctx.rerender })),
  );
}
