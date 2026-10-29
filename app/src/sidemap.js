// Side (sagittal) view: a silhouette of the brain with a rectangle marking the current slice's position along the AP axis.
// The silhouette is built from the dorsal/ventral extent of the whole-brain outline of every coronal slice, so it needs
// no extra data. Anterior is on the right, matching the slider.
import { svgEl } from './ui.js';

// -> { x0, x1, y0, y1 (mm), pts: [{ ap, top, bot }] sorted by AP, top/bot = dorsal/ventral edge in mm }
export function sideProfile(data) {
  const mm = (data.meta?.unitUm ?? 25) / 1000;
  const raw = [];
  for (const s of data.slices) {
    let top = Infinity;
    let bot = -Infinity;
    for (const ring of s.outline ?? []) for (const [, y] of ring) { if (y < top) top = y; if (y > bot) bot = y; }
    if (top <= bot) raw.push({ ap: s.bregma, top: top * mm, bot: bot * mm });
  }
  raw.sort((a, b) => a.ap - b.ap);
  const pts = raw.map((p, i) => {
    const w = raw.slice(Math.max(0, i - 1), i + 2); // 3-point smoothing
    return { ap: p.ap, top: w.reduce((a, q) => a + q.top, 0) / w.length, bot: w.reduce((a, q) => a + q.bot, 0) / w.length };
  });
  if (!pts.length) return null;
  const y0 = Math.min(...pts.map((p) => p.top));
  const y1 = Math.max(...pts.map((p) => p.bot));
  return { x0: pts[0].ap, x1: pts[pts.length - 1].ap, y0, y1, pts };
}

// Extent of the brain (mm) at a given AP, from the nearest slice.
export function extentAt(profile, ap) {
  let best = profile.pts[0];
  for (const p of profile.pts) if (Math.abs(p.ap - ap) < Math.abs(best.ap - ap)) best = p;
  return best;
}

export function createSideMap(data, { height = 56 } = {}) {
  const prof = sideProfile(data);
  if (!prof) return null;
  const pad = 0.25; // mm of breathing room around the silhouette
  const vx = prof.x0 - pad;
  const vy = prof.y0 - pad;
  const vw = prof.x1 - prof.x0 + 2 * pad;
  const vh = prof.y1 - prof.y0 + 2 * pad;
  const X = (ap) => ap - vx; // anterior = right
  const Y = (y) => y - vy;

  const d = `M${prof.pts.map((p) => `${X(p.ap).toFixed(3)},${Y(p.top).toFixed(3)}`).join(' L')} L${[...prof.pts].reverse().map((p) => `${X(p.ap).toFixed(3)},${Y(p.bot).toFixed(3)}`).join(' L')} Z`;
  const body = svgEl('path', { d, class: 'side-body' });
  const band = svgEl('rect', { class: 'side-band', visibility: 'hidden', y: 0, height: vh });
  const right = svgEl('rect', { class: 'side-right', visibility: 'hidden', y: 0, height: vh });
  const cur = svgEl('rect', { class: 'side-cur', rx: 0.08 });
  const svg = svgEl('svg', { class: 'side', viewBox: `0 0 ${vw.toFixed(3)} ${vh.toFixed(3)}`, role: 'img', 'aria-label': 'Side view of the brain. The rectangle shows where the current slice is.', style: `height:${height}px` }, body, band, right, cur);

  const slab = Math.max(0.3, vw / 40); // rectangle width in mm: thin but always visible

  return {
    el: svg,
    setSlice(ap) {
      const e = extentAt(prof, ap);
      const gap = 0.18;
      cur.setAttribute('x', (X(ap) - slab / 2).toFixed(3));
      cur.setAttribute('width', slab.toFixed(3));
      cur.setAttribute('y', (Y(e.top) - gap).toFixed(3));
      cur.setAttribute('height', (e.bot - e.top + 2 * gap).toFixed(3));
    },
    // after a guess: show where the target region lives along AP (range) and its best slice (ap)
    setTarget(info) {
      for (const el of [band, right]) el.setAttribute('visibility', info ? 'visible' : 'hidden');
      if (!info) return;
      const [a, b] = info.range;
      band.setAttribute('x', X(Math.max(a, prof.x0)).toFixed(3));
      band.setAttribute('width', Math.max(0.1, Math.min(b, prof.x1) - Math.max(a, prof.x0)).toFixed(3));
      right.setAttribute('x', (X(info.ap) - 0.06).toFixed(3));
      right.setAttribute('width', '0.12');
    },
  };
}
