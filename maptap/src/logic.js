// Pure game logic (no DOM) so it can be unit-tested with `node --test`.

export function pointInRing(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function nearestOnSegment(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  const q = [a[0] + t * dx, a[1] + t * dy];
  return { dist: Math.hypot(p[0] - q[0], p[1] - q[1]), q };
}

// Nearest point of a region (set of rings) to p. dist 0 and q = p when p is inside.
export function nearestOnRegion(p, rings) {
  let best = { dist: Infinity, q: null };
  for (const ring of rings) {
    if (pointInRing(p, ring)) return { dist: 0, q: [...p] };
    for (let i = 0; i < ring.length; i++) {
      const c = nearestOnSegment(p, ring[i], ring[(i + 1) % ring.length]);
      if (c.dist < best.dist) best = c;
    }
  }
  return best;
}

export const distToRegion = (p, rings) => nearestOnRegion(p, rings).dist;

export function ringArea(ring) {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

export const largestRing = (rings) => rings.reduce((a, b) => (ringArea(b) > ringArea(a) ? b : a));

export const ringCenter = (ring) => [
  ring.reduce((s, q) => s + q[0], 0) / ring.length,
  ring.reduce((s, q) => s + q[1], 0) / ring.length,
];

export const nearestSlice = (slices, ap) =>
  slices.reduce((a, b) => (Math.abs(b.bregma - ap) < Math.abs(a.bregma - ap) ? b : a));

// Most specific (smallest) region containing p; regions may be nested (parent + child structures).
export function regionAt(slice, p) {
  let best = null;
  let bestArea = Infinity;
  for (const r of slice.regions) {
    for (const ring of r.polygons) {
      if (pointInRing(p, ring)) {
        const a = ringArea(ring);
        if (a < bestArea) {
          best = r.structure;
          bestArea = a;
        }
      }
    }
  }
  return best;
}

// Closest point of structure `key` to the guess in 3D: AP = guessed slice, ML/DV = click.
// Searches every slice containing the structure; returns the slice with the smallest 3D distance.
export function closest3D(data, key, ap, p) {
  const mmPerUnit = (data.meta?.unitUm ?? 10) / 1000;
  let best = null;
  for (const slice of data.slices) {
    const dAp = Math.abs(slice.bregma - ap);
    if (best && dAp >= best.dist3) continue;
    const region = slice.regions.find((r) => r.structure === key);
    if (!region) continue;
    const { dist, q } = nearestOnRegion(p, region.polygons);
    const dist2 = dist * mmPerUnit;
    const dist3 = Math.hypot(dist2, dAp);
    if (!best || dist3 < best.dist3) best = { dist3, dist2, dAp, slice, q };
  }
  return best;
}

// Score = maxPts decreasing linearly with the 3D distance (mm) to the nearest point of the target, 0 at falloffMm.
// Returns `slice` (the correct slice: where the closest point lies) and `guessSlice` (what the player was looking at).
export function scoreGuess({ data, ap, p, key, maxPts, falloffMm }) {
  const guessSlice = nearestSlice(data.slices, ap);
  const c = closest3D(data, key, guessSlice.bregma, p);
  if (!c) throw new Error(`structure ${key} appears on no slice`);
  const falloff = falloffMm ?? data.scoring?.falloffMm ?? 4.0;
  const pts = Math.round(maxPts * Math.max(0, 1 - c.dist3 / falloff));
  return { ...c, guessSlice, pts, maxPts, falloff, hit: c.dist3 === 0 };
}