// Light / dark theme. The inline script in index.html sets data-theme before first paint; this adds the footer switch.
import { h } from './ui.js';

const KEY = 'braintap:theme'; // 'light' | 'dark' | absent = follow the device
const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = (v) => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch { /* private mode */ } };

function apply() {
  const pref = read();
  const dark = pref ? pref === 'dark' : !!mq?.matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#14122b' : '#fcf2f5');
}

export function mountThemeSwitch(el) {
  const opts = [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']];
  const bar = h('div', { class: 'seg seg-small', role: 'group', 'aria-label': 'Theme' });
  const draw = () => {
    const cur = read() || 'auto';
    bar.replaceChildren(...opts.map(([v, label]) => h('button', { type: 'button', 'aria-pressed': String(cur === v), onclick: () => { write(v === 'auto' ? null : v); apply(); draw(); } }, label)));
  };
  draw();
  el.replaceChildren(h('span', { class: 'small' }, 'Theme '), bar);
  mq?.addEventListener?.('change', apply);
  apply();
}
