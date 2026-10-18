import './style.css';
import { largestRing, nearestSlice, regionAt, ringCenter, scoreGuess } from './logic.js';
import { dailyKey, pickRounds, puzzleNumber, shareText } from './daily.js';

// ---------- config ----------
const ROUND_PTS = [25, 35, 40]; // total 100
const ROUND_LEVELS = [[1], [2, 3], [4, 5]]; // difficulty ramp (levels from tools/regions.csv)
const ROUNDS = ROUND_PTS.length;
const MAX_TOTAL = ROUND_PTS.reduce((a, b) => a + b, 0);

const qs = new URLSearchParams(location.search);
const PRACTICE = qs.has('practice'); // random puzzle, replayable
const SHOW_HINTS = qs.has('hints'); // draw region boundaries (dev aid)
const DAY = qs.get('date') ?? dailyKey(); // UTC date -> same puzzle for everyone

// ---------- data ----------
const BASE = import.meta.env.BASE_URL;
const data = await (await fetch(`${BASE}slices.json`)).json();
const [W, H] = data.canvas;
const S = 1000 / W; // slice units -> canvas px

const $ = (id) => document.getElementById(id);
const canvas = $('c');
const ctx = canvas.getContext('2d');
const slider = $('ap');
const field = [canvas, document.querySelector('.ctl')];
const dpr = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = Math.round(W * S * dpr);
canvas.height = Math.round(H * S * dpr);
const px = (n) => n / S; // line widths / font sizes in slice units
const fmtAp = (v) => (v > 0 ? '+' : '') + v.toFixed(2);

// ---------- template images (lazy, cached) ----------
const imgCache = new Map();
function sliceImage(slice) {
  if (!slice.image) return null;
  let img = imgCache.get(slice.id);
  if (!img) {
    img = new Image();
    img.onload = () => render();
    img.src = BASE + slice.image;
    imgCache.set(slice.id, img);
  }
  return img.complete && img.naturalWidth ? img : null;
}

// ---------- game state ----------
let targets, round, total, scores, phase, result;

function start() {
  targets = pickRounds(data.structures, PRACTICE ? String(Math.random()) : DAY, ROUND_LEVELS);
  round = 0;
  total = 0;
  scores = [];
  nextRound();
}

function nextRound() {
  phase = 'select';
  result = null;
  field.forEach((el) => (el.hidden = false));
  slider.disabled = false;
  slider.value = mid;
  syncOut();
  for (const id of ['result', 'next', 'view', 'copy']) $(id).hidden = true;
  $('round').textContent = round + 1;
  $('total').textContent = total;
  const s = data.structures[targets[round]];
  $('prompt').textContent = `Find: ${s.name}`;
  $('sub').textContent = `Level ${s.level} · ${ROUND_PTS[round]} pts`;
  render();
}

function resultText(r) {
  const name = data.structures[r.key].name;
  const out = [r.hit ? `Correct! +${r.pts}/${r.maxPts}` : `Not quite: +${r.pts}/${r.maxPts}`];
  if (!r.hit) {
    out.push(`Nearest point of ${name} is ${r.dist3.toFixed(2)} mm away (AP ${r.dAp.toFixed(2)} mm, in-plane ${r.dist2.toFixed(2)} mm).`);
    out.push(`Correct slice: AP ${fmtAp(r.slice.bregma)} · your slice: AP ${fmtAp(r.guessSlice.bregma)}.`);
  }
  if (r.clicked && r.clicked !== r.key) out.push(`You clicked: ${data.structures[r.clicked].name}.`);
  return out.join('\n');
}

function showSlice() {
  const s = result.view === 'correct' ? result.slice : result.guessSlice;
  slider.value = s.bregma;
  syncOut();
  $('view').textContent =
    result.view === 'correct' ? `Show my slice (AP ${fmtAp(result.guessSlice.bregma)})` : `Show correct slice (AP ${fmtAp(result.slice.bregma)})`;
  render();
}

function onGuess(e) {
  if (phase !== 'select') return;
  const box = canvas.getBoundingClientRect();
  const p = [((e.clientX - box.left) * W) / box.width, ((e.clientY - box.top) * H) / box.height];
  const key = targets[round];
  const r = scoreGuess({ data, ap: +slider.value, p, key, maxPts: ROUND_PTS[round] });

  total += r.pts;
  scores.push(r.pts);
  result = { ...r, p, key, clicked: regionAt(r.guessSlice, p), view: 'correct' }; // wrong -> start on the correct slice
  phase = 'result';
  slider.disabled = true;

  $('total').textContent = total;
  $('result').hidden = false;
  $('result').textContent = resultText(result);
  $('view').hidden = result.slice === result.guessSlice;
  $('next').textContent = round === ROUNDS - 1 ? 'Finish' : 'Next';
  $('next').hidden = false;
  showSlice();
}

function onNext() {
  if (phase === 'done') return start();
  round++;
  if (round >= ROUNDS) return finish();
  nextRound();
}

function finish() {
  phase = 'done';
  field.forEach((el) => (el.hidden = true));
  for (const id of ['view']) $(id).hidden = true;
  $('prompt').textContent = `Final score: ${total} / ${MAX_TOTAL}`;
  $('sub').textContent = targets.map((k) => data.structures[k].name).join(' · ');
  $('result').hidden = false;
  $('result').textContent = shareText({ num: puzzleNumber(DAY), day: PRACTICE ? null : DAY, scores, maxes: ROUND_PTS });
  $('copy').textContent = 'Copy result';
  $('copy').hidden = false;
  $('next').textContent = 'Play again';
  $('next').hidden = !PRACTICE; // daily puzzle: one play
}

// ---------- rendering ----------
function tracePath(ring) {
  ctx.beginPath();
  ring.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

function drawRegion(region, fill, stroke, width) {
  for (const ring of region.polygons) {
    tracePath(ring);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = px(width);
    ctx.stroke();
  }
}

function label(text, [x, y]) {
  ctx.font = `${px(16)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.lineWidth = px(4);
  ctx.strokeStyle = '#000';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = '#fff';
  ctx.fillText(text, x, y);
}

function render() {
  if (phase === 'done') return;
  ctx.setTransform(S * dpr, 0, 0, S * dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const reveal = phase === 'result';
  const slice = reveal ? (result.view === 'correct' ? result.slice : result.guessSlice) : nearestSlice(data.slices, +slider.value);
  const img = sliceImage(slice);

  if (img) {
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, W, H);
  } else {
    for (const ring of slice.outline) {
      tracePath(ring);
      ctx.fillStyle = '#1b2330';
      ctx.fill();
    }
  }
  for (const ring of slice.outline) {
    tracePath(ring);
    ctx.strokeStyle = '#4a5a73';
    ctx.lineWidth = px(1.5);
    ctx.stroke();
  }

  if (SHOW_HINTS || !slice.image) {
    // no template image (mock data) -> outlines are the only context
    for (const region of slice.regions) drawRegion(region, null, 'rgba(160,190,230,0.45)', 1);
  }

  if (!reveal) return;
  const byKey = (k) => slice.regions.find((r) => r.structure === k);
  const clicked = slice === result.guessSlice && result.clicked !== result.key && byKey(result.clicked);
  if (clicked) drawRegion(clicked, null, '#60a5fa', 2);

  const target = byKey(result.key);
  if (target) {
    drawRegion(target, 'rgba(80,200,120,0.4)', '#50c878', 2.5);
    label(result.key, ringCenter(largestRing(target.polygons)));
  }
  if (result.view === 'correct' && !result.hit) {
    ctx.beginPath(); // click -> nearest point of the target
    ctx.setLineDash([px(6), px(4)]);
    ctx.moveTo(...result.p);
    ctx.lineTo(...result.q);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = px(1.5);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.beginPath();
  ctx.arc(result.p[0], result.p[1], px(8), 0, Math.PI * 2);
  ctx.fillStyle = '#ef4444';
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = px(2);
  ctx.stroke();
}

// ---------- init ----------
const step = data.meta?.stepMm ?? 0.05;
const [apMin, apMax] = data.apRange;
slider.min = apMin;
slider.max = apMax;
slider.step = step;
const mid = apMin + Math.round((apMax - apMin) / 2 / step) * step;

$('rounds').textContent = ROUNDS;
$('maxTotal').textContent = MAX_TOTAL;
const syncOut = () => ($('apOut').textContent = fmtAp(+slider.value));
slider.addEventListener('input', () => {
  syncOut();
  render();
});
canvas.addEventListener('pointerdown', onGuess);
$('next').addEventListener('click', onNext);
$('view').addEventListener('click', () => {
  result.view = result.view === 'correct' ? 'guess' : 'correct';
  showSlice();
});
$('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('result').textContent);
    $('copy').textContent = 'Copied!';
  } catch {
    $('copy').textContent = 'Copy failed: select the text instead';
  }
});
start();
setTimeout(() => data.slices.forEach(sliceImage), 300); // warm the image cache
