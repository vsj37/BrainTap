// Tiny DOM helpers. Text always goes in as text nodes (never innerHTML), because names and
// imported backup data come from users.

export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
  return el;
}

export function svgEl(tag, attrs = {}, ...kids) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
  return el;
}

// Same thresholds as the share-text squares in daily.js.
export const tier = (pts, max) => {
  const r = max ? pts / max : 0;
  return r >= 0.9 ? 'high' : r >= 0.5 ? 'mid' : 'low';
};
export const square = (t) => ({ high: '🟩', mid: '🟨', low: '🟥' })[t];

export const fmtAp = (v) => (v > 0 ? '+' : '') + v.toFixed(2);

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthName = (m) => MON[m - 1];
export const fmtDay = (day, opts = { weekday: 'long', day: 'numeric', month: 'long' }) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { ...opts, timeZone: 'UTC' });
