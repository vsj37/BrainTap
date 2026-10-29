import { svgEl, monthName } from './ui.js';

const label = (unit, key) => {
  const [, m, d] = key.split('-').map(Number);
  return unit === 'day' ? String(d) : unit === 'week' ? `${monthName(m)} ${d}` : monthName(m);
};
const longLabel = (unit, key) => {
  const [y, m, d] = key.split('-').map(Number);
  return unit === 'day' ? `${monthName(m)} ${d}` : unit === 'week' ? `Week of ${monthName(m)} ${d}` : `${monthName(m)} ${y}`;
};

// points: [{ key, count, avg }] from store.series(). Bars are coloured like the round results.
export function barChart(points, unit) {
  const W = 360;
  const H = 200;
  const pad = { l: 28, r: 6, t: 16, b: 26 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const slot = iw / points.length;
  const bw = Math.min(slot * 0.68, 28);
  const y = (v) => pad.t + ih * (1 - v / 100);

  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': `Average score by ${unit}` });
  for (const g of [0, 50, 100]) {
    svg.append(svgEl('line', { x1: pad.l, x2: W - pad.r, y1: y(g), y2: y(g), class: 'grid' }));
    svg.append(svgEl('text', { x: pad.l - 6, y: y(g) + 3.5, class: 'axis', 'text-anchor': 'end' }, String(g)));
  }
  points.forEach((p, i) => {
    const cx = pad.l + slot * (i + 0.5);
    const tip = p.avg == null ? `${longLabel(unit, p.key)}: no games` : `${longLabel(unit, p.key)}: ${p.avg} (${p.count} ${p.count === 1 ? 'game' : 'games'})`;
    const g = svgEl('g', {}, svgEl('title', {}, tip));
    if (p.avg == null) {
      g.append(svgEl('rect', { x: cx - bw / 2, y: y(0) - 3, width: bw, height: 3, rx: 1.5, class: 'bar-empty' }));
    } else {
      const t = p.avg >= 90 ? 'high' : p.avg >= 50 ? 'mid' : 'low';
      const bh = Math.max(3, (ih * p.avg) / 100);
      g.append(svgEl('rect', { x: cx - bw / 2, y: pad.t + ih - bh, width: bw, height: bh, rx: 4, class: `bar bar-${t}` }));
      g.append(svgEl('text', { x: cx, y: pad.t + ih - bh - 4, class: 'bar-val', 'text-anchor': 'middle' }, String(p.avg)));
    }
    if (unit !== 'week' || (points.length - 1 - i) % 2 === 0) {
      g.append(svgEl('text', { x: cx, y: H - 8, class: 'axis', 'text-anchor': 'middle' }, label(unit, p.key)));
    }
    svg.append(g);
  });
  return svg;
}
