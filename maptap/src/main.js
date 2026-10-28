import '@fontsource-variable/fredoka';
import './style.css';
import { APP_NAME, STORAGE_KEY, TAGLINE, ROUND_PTS, ROUND_LEVELS, FALLOFF_MM, ART, CREDITS } from './config.js';
import { largestRing, nearestSlice, regionAt, ringCenter, scoreGuess } from './logic.js';
import { dailyKey, pickRounds, puzzleNumber, shareText } from './daily.js';
import * as store from './store.js';
import { barChart } from './chart.js';
import { h, tier, square, fmtAp, fmtDay } from './ui.js';

const ROUNDS = ROUND_PTS.length;
const MAX_TOTAL = ROUND_PTS.reduce((a, b) => a + b, 0);
const qs = new URLSearchParams(location.search);
const SHOW_HINTS = qs.has('hints'); // dev aid: draw region outlines
const currentDay = () => qs.get('date') ?? dailyKey(); // UTC date: same puzzle for everyone; ?date= for testing
const BASE = import.meta.env.BASE_URL;
const $ = (id) => document.getElementById(id);
const sum = (a) => a.reduce((x, y) => x + y, 0);
const reducedMotion = !window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

document.title = APP_NAME;
$('appName').textContent = APP_NAME;
for (const c of CREDITS) {
  $('credits').append(c.href ? h('a', { href: c.href }, c.text) : c.text, ' ');
}

// ---------- data ----------
let data;
try {
  data = await (await fetch(`${BASE}slices.json`)).json();
} catch {
  $('vHome').replaceChildren(h('p', {}, 'The brain slices could not be loaded. Check your connection and reload the page.'));
  throw new Error('slices.json failed to load');
}
const [W, H] = data.canvas;
const S = 1000 / W; // slice units -> canvas px
const nameOf = (key) => data.structures[key]?.name ?? key;

// ---------- profile (saved in this browser) ----------
const memory = new Map();
const storage = (() => {
  try {
    localStorage.setItem('_t', '1');
    localStorage.removeItem('_t');
    return localStorage;
  } catch {
    return null;
  }
})() ?? { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v), volatile: true };
let profile = store.loadProfile(storage);
function commit(next) {
  profile = next;
  store.saveProfile(storage, profile);
}

// ---------- routing: #  = home, #stats = stats, #play = the game in progress ----------
const views = { home: $('vHome'), game: $('vGame'), stats: $('vStats') };
let game = null;
let timer = null;

function route() {
  clearInterval(timer);
  const hash = location.hash;
  let name = hash === '#stats' ? 'stats' : hash === '#play' && game ? 'game' : 'home';
  for (const [k, el] of Object.entries(views)) el.hidden = k !== name;
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const on = a.dataset.nav === (name === 'stats' ? 'stats' : 'home');
    on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
  });
  if (name === 'home') renderHome();
  if (name === 'stats') renderStats();
  window.scrollTo(0, 0);
}
function go(target) {
  if (target === '') {
    history.pushState(null, '', location.pathname + location.search);
    route();
  } else if (location.hash === target) route();
  else location.hash = target;
}
window.addEventListener('hashchange', route);
// Another tab saved new stats: pick them up so this tab doesn't overwrite them later.
window.addEventListener('storage', (e) => {
  if (e.key !== STORAGE_KEY) return;
  profile = store.loadProfile(storage);
  if (!views.home.hidden) renderHome();
  if (!views.stats.hidden) renderStats();
});

// ---------- shared bits ----------
function countUp(el, to) {
  el.textContent = String(to);
  if (reducedMotion || to === 0 || typeof requestAnimationFrame !== 'function') return;
  const t0 = performance.now();
  const tick = (t) => {
    const k = Math.min(1, (t - t0) / 650);
    el.textContent = String(Math.round(to * (1 - (1 - k) ** 3)));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function summaryNode(entry) {
  const total = sum(entry.scores);
  return h(
    'div',
    { class: 'summary' },
    h('div', { class: 'sum-score' }, h('span', { class: 'sum-num' }, String(total)), h('span', { class: 'of' }, `/${sum(entry.maxes)}`)),
    h('div', { class: 'sum-squares', 'aria-hidden': 'true' }, entry.scores.map((s, i) => square(tier(s, entry.maxes[i]))).join('')),
    h(
      'ul',
      { class: 'sum-list' },
      entry.scores.map((s, i) =>
        h('li', {}, h('span', { class: `dot dot-${tier(s, entry.maxes[i])}` }), h('span', { class: 'sum-name' }, nameOf(entry.targets[i] ?? '')), h('span', { class: 'sum-pts' }, `${s}/${entry.maxes[i]}`)),
      ),
    ),
  );
}

function shareButton(entry, day) {
  const text = shareText({ appName: APP_NAME, num: puzzleNumber(day ?? currentDay()), day, scores: entry.scores, maxes: entry.maxes });
  const wrap = h('div', {});
  const btn = h('button', { type: 'button', class: 'btn btn-primary' }, 'Share result');
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = 'Copied';
    } catch {
      btn.textContent = 'Copy it from the box below';
      wrap.append(h('textarea', { class: 'copy-fallback', rows: '4', readonly: true, 'aria-label': 'Result to copy' }, text));
    }
  });
  wrap.append(btn);
  wrap.dataset.share = text;
  return wrap;
}

function statStrip(items, cols = 4) {
  return h('ul', { class: 'strip', style: `--cols:${cols}` }, items.map(([label, val]) => h('li', {}, h('b', {}, String(val)), h('span', {}, label))));
}

// ---------- home ----------
function renderHome() {
  clearInterval(timer);
  const day = currentDay();
  const entry = profile.history[day];
  const resume = profile.progress?.day === day ? profile.progress.scores.length : 0;
  const st = store.streaks(profile.history, day);
  const sm = store.summary(profile.history);
  const num = puzzleNumber(day);

  const hero = h('div', { class: 'hero' }, ART.hero && h('img', { class: 'art-hero', src: `${BASE}art/${ART.hero}`, alt: '' }), h('h1', {}, APP_NAME), h('p', { class: 'tag' }, TAGLINE));

  let today;
  if (entry) {
    const next = h('p', { class: 'next-in' });
    const live = !qs.get('date'); // a fixed ?date= has no countdown
    const tickCountdown = () => {
      if (!live) return;
      const ms = store.dayToMs(day) + 864e5 - Date.now();
      if (ms <= 0) return renderHome(); // midnight UTC passed: show the new day's slide
      const mins = Math.floor(ms / 60000);
      next.textContent = `Next slide in ${Math.floor(mins / 60)} h ${mins % 60} min`;
    };
    tickCountdown();
    clearInterval(timer);
    timer = setInterval(tickCountdown, 30000);
    today = h('section', { class: 'today' }, h('h2', {}, `Slide #${num}`), h('p', { class: 'date' }, fmtDay(day)), summaryNode(entry), h('div', { class: 'btns' }, shareButton(entry, day)), next);
  } else {
    today = h(
      'section',
      { class: 'today' },
      h('h2', {}, `Today's slide #${num}`),
      h('p', { class: 'date' }, fmtDay(day)),
      h('p', { class: 'lede' }, `${ROUNDS} brain regions, each harder than the last. Find them on the slice.`),
      h('button', { type: 'button', class: 'btn btn-primary', onclick: () => startGame('daily') }, resume ? `Continue (${resume} of ${ROUNDS} done)` : "Play today's slide"),
    );
  }

  views.home.replaceChildren(
    hero,
    today,
    statStrip([['Day streak', st.current], ['Played', sm.played], ['Average', sm.avg ?? '–'], ['Best', sm.best ?? '–']]),
    h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => startGame('practice') }, 'Practice round'), h('a', { class: 'link', href: '#stats' }, 'Your stats')),
    h(
      'section',
      { class: 'how' },
      h('h2', {}, 'How it works'),
      h('p', {}, 'Drag the slider to choose a slice. AP is its distance from Bregma in millimetres: positive is toward the nose, negative toward the back.'),
      h('p', {}, 'Tap the region you were asked to find.'),
      h('p', {}, `Your score drops with the distance to the nearest part of the region, counting the slice offset too. A miss shows you where it was.`),
    ),
  );
}

// ---------- stats ----------
let chartUnit = 'day';
let notice = '';
const CHART = { day: [14, 'Daily score, last 14 days'], week: [12, 'Average score per week, last 12 weeks'], month: [12, 'Average score per month, last 12 months'] };

function renderStats() {
  const day = currentDay();
  const st = store.streaks(profile.history, day);
  const sm = store.summary(profile.history);
  const has = sm.played > 0;
  const recent = Object.keys(profile.history).sort().reverse().slice(0, 10);

  const nameInput = h('input', { type: 'text', id: 'pname', maxlength: '24', placeholder: 'Add a name', value: profile.name });
  nameInput.addEventListener('change', () => {
    commit({ ...profile, name: nameInput.value.trim().slice(0, 24) });
    renderStats();
  });

  const msg = h('p', { class: 'msg', role: 'status' }, notice);
  notice = '';
  const area = h('textarea', { rows: '3', placeholder: 'Paste a backup code here', 'aria-label': 'Backup code' });

  const [n, caption] = CHART[chartUnit];
  const seg = h(
    'div',
    { class: 'seg', role: 'group', 'aria-label': 'Chart range' },
    [['day', 'Days'], ['week', 'Weeks'], ['month', 'Months']].map(([u, label]) =>
      h('button', { type: 'button', 'aria-pressed': String(chartUnit === u), onclick: () => { chartUnit = u; renderStats(); } }, label),
    ),
  );

  const parts = [
    h('div', { class: 'stats-head' }, h('h1', {}, profile.name ? `${profile.name}'s stats` : 'Your stats'), h('label', { class: 'name-field' }, 'Name', nameInput)),
    statStrip([['Day streak', st.current], ['Best streak', st.best], ['Played', sm.played], ['Average', sm.avg ?? '–'], ['Best', sm.best ?? '–']], 5),
    has
      ? h('section', {}, seg, h('div', { class: 'chart-wrap' }, barChart(store.series(profile.history, chartUnit, day, n), chartUnit)), h('p', { class: 'caption' }, caption))
      : h('section', { class: 'empty' }, h('p', {}, 'No games yet. Play a slide and your scores show up here.'), h('button', { type: 'button', class: 'btn btn-primary', onclick: () => startGame('daily') }, "Play today's slide")),
    has &&
      h(
        'section',
        { class: 'section' },
        h('h2', {}, 'Recent games'),
        h(
          'ul',
          { class: 'recent' },
          recent.map((d) => {
            const e = profile.history[d];
            return h('li', {}, h('span', { class: 'when' }, fmtDay(d, { weekday: 'short', day: 'numeric', month: 'short' })), h('span', { class: 'sq', 'aria-hidden': 'true' }, e.scores.map((s, i) => square(tier(s, e.maxes[i]))).join('')), h('span', { class: 'pts' }, `${store.pct(e)}`));
          }),
        ),
      ),
    h(
      'section',
      { class: 'section' },
      h('h2', {}, 'Back up or move your stats'),
      h('p', {}, storage.volatile ? 'This browser is not letting the page save anything, so your stats will disappear when you close the tab.' : 'Your stats are saved in this browser only. Copy a backup code to keep them safe or move them to another device.'),
      h(
        'div',
        { class: 'stack' },
        h('button', { type: 'button', class: 'btn btn-ghost', onclick: async () => {
          try {
            await navigator.clipboard.writeText(store.exportCode(profile));
            msg.textContent = 'Backup code copied. Paste it into the box on your other device.';
          } catch {
            area.value = store.exportCode(profile);
            msg.textContent = 'Copy the code from the box below.';
          }
        } }, 'Copy backup code'),
        area,
        h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => {
          try {
            const imported = store.parseCode(area.value);
            const merged = store.mergeProfiles(profile, imported);
            const added = Object.keys(merged.history).length - Object.keys(profile.history).length;
            commit(merged);
            notice = added ? `Imported ${added} ${added === 1 ? 'day' : 'days'}.` : 'Nothing new to import.';
            renderStats();
          } catch (err) {
            msg.textContent = err.message;
          }
        } }, 'Import backup code'),
        msg,
        has && h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => {
          if (confirm('Erase all stats saved in this browser? This cannot be undone.')) {
            commit(store.emptyProfile());
            renderStats();
          }
        } }, 'Erase my stats'),
      ),
    ),
  ];
  views.stats.replaceChildren(...parts.filter(Boolean));
}

// ---------- the game ----------
const canvas = $('c');
const ctx = canvas.getContext('2d');
const slider = $('ap');
const dpr = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = Math.round(W * S * dpr);
canvas.height = Math.round(H * S * dpr);
const px = (n) => n / S; // line widths / font sizes in slice units
const step = data.meta?.stepMm ?? 0.05;
const [apMin, apMax] = data.apRange;
slider.min = apMin;
slider.max = apMax;
slider.step = step;
const mid = apMin + Math.round((apMax - apMin) / 2 / step) * step;

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

const shown = () => nearestSlice(data.slices, +slider.value);
const syncOut = () => ($('apOut').textContent = `${fmtAp(+slider.value)} mm`);
function onSlide() {
  syncOut();
  render();
  updateViewBtn();
}
function goTo(slice) {
  slider.value = slice.bregma;
  onSlide();
}

function startGame(mode) {
  const day = currentDay();
  if (mode === 'daily' && profile.history[day]) return go('');
  const targets = pickRounds(data.structures, mode === 'daily' ? day : String(Math.random()), ROUND_LEVELS);
  const resumed = mode === 'daily' && profile.progress?.day === day ? profile.progress.scores.slice(0, ROUNDS - 1) : [];
  game = { mode, day, targets, scores: resumed, round: resumed.length, phase: 'select', result: null };
  $('final').hidden = true;
  $('stage').hidden = false;
  go('#play');
  nextRound();
}

function renderPips() {
  $('pips').replaceChildren(
    ...ROUND_PTS.map((max, i) => {
      const done = i < game.scores.length;
      const cls = done ? `pip-${tier(game.scores[i], max)}` : i === game.round ? 'pip-now' : '';
      return h('li', { class: `pip ${cls}`, ...(i === game.round && !done ? { 'aria-current': 'step' } : {}) }, done ? `${game.scores[i]}/${max}` : String(max));
    }),
  );
  $('total').textContent = String(sum(game.scores));
}

function nextRound() {
  game.phase = 'select';
  game.result = null;
  const s = data.structures[game.targets[game.round]];
  $('prompt').textContent = s.name;
  $('lvl').textContent = `Level ${s.level}`;
  $('worth').textContent = `${ROUND_PTS[game.round]} pts`;
  for (const id of ['result', 'view', 'nextBtn']) $(id).hidden = true;
  canvas.classList.remove('locked');
  slider.value = mid;
  renderPips();
  onSlide();
}

function verdict(r) {
  const t = tier(r.pts, r.maxPts); // wording follows the same tiers as the colours
  return r.hit ? 'Bullseye!' : t === 'high' ? 'So close' : t === 'mid' ? 'Getting warm' : r.pts > 0 ? 'Not quite' : 'Way off';
}

function onGuess(e) {
  if (!game || game.phase !== 'select') return;
  const box = canvas.getBoundingClientRect();
  const p = [((e.clientX - box.left) * W) / box.width, ((e.clientY - box.top) * H) / box.height];
  const key = game.targets[game.round];
  const r = scoreGuess({ data, ap: +slider.value, p, key, maxPts: ROUND_PTS[game.round], falloffMm: FALLOFF_MM });
  game.scores.push(r.pts);
  game.phase = 'result';
  game.result = { ...r, p, key, clicked: regionAt(r.guessSlice, p) };
  canvas.classList.add('locked');

  if (game.mode === 'daily') {
    commit(
      game.scores.length >= ROUNDS
        ? store.recordResult(profile, game.day, { scores: game.scores, targets: game.targets, maxes: ROUND_PTS })
        : store.saveProgress(profile, game.day, game.scores),
    );
  }
  showResult();
  renderPips();
  goTo(r.slice); // start on the correct slice; the slider stays free
}

function showResult() {
  const r = game.result;
  const t = tier(r.pts, r.maxPts);
  const pts = h('span', { class: `big big-${t}`, 'aria-hidden': 'true' }, String(r.pts));
  const lines = [];
  if (r.hit) lines.push(h('p', {}, 'Right on the target.'));
  else {
    lines.push(h('p', {}, `${nameOf(r.key)} was ${r.dist3.toFixed(1)} mm away at its nearest point.`));
    if (r.slice !== r.guessSlice) lines.push(h('p', {}, `Its closest slice is AP ${fmtAp(r.slice.bregma)}. You chose AP ${fmtAp(r.guessSlice.bregma)}.`));
    if (r.clicked && r.clicked !== r.key) lines.push(h('p', {}, `You tapped ${nameOf(r.clicked)}.`));
  }
  $('result').replaceChildren(
    h('div', { class: 'res-head' }, pts, h('span', { class: 'of', 'aria-hidden': 'true' }, `/${r.maxPts}`), h('span', { class: 'sr-only' }, `${r.pts} of ${r.maxPts} points.`), h('p', { class: `verdict verdict-${t}` }, verdict(r))),
    ...lines,
  );
  $('result').hidden = false;
  countUp(pts, r.pts);
  $('nextBtn').textContent = game.scores.length >= ROUNDS ? 'See results' : 'Next region';
  $('nextBtn').hidden = false;
  $('view').hidden = r.slice === r.guessSlice;
}

function updateViewBtn() {
  if (!game || game.phase !== 'result') return;
  const r = game.result;
  $('view').textContent = shown() === r.guessSlice ? `Go to correct slice (AP ${fmtAp(r.slice.bregma)})` : `Go to my slice (AP ${fmtAp(r.guessSlice.bregma)})`;
}

function showFinal() {
  game.phase = 'done';
  const entry = { scores: game.scores, targets: game.targets, maxes: ROUND_PTS };
  const daily = game.mode === 'daily';
  $('stage').hidden = true;
  $('final').replaceChildren(
    h('h2', { class: 'final-title' }, daily ? `Slide #${puzzleNumber(game.day)} done` : 'Practice round done'),
    summaryNode(entry),
    h(
      'div',
      { class: 'btns' },
      shareButton(entry, daily ? game.day : null),
      !daily && h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => startGame('practice') }, 'Play again'),
      h('a', { class: 'btn btn-ghost', href: '#stats' }, 'Your stats'),
      h('a', { class: 'btn btn-ghost', href: '#' }, 'Home'),
    ),
  );
  $('final').hidden = false;
  window.scrollTo(0, 0);
}

// ---------- drawing ----------
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
  ctx.font = `600 ${px(16)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.lineWidth = px(4);
  ctx.strokeStyle = '#0d0b2a';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = '#fff';
  ctx.fillText(text, x, y);
}

function render() {
  if (!game) return;
  ctx.setTransform(S * dpr, 0, 0, S * dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const slice = shown();
  const img = sliceImage(slice);
  if (img) {
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, W, H);
  } else {
    for (const ring of slice.outline) {
      tracePath(ring);
      ctx.fillStyle = '#1d1b4d';
      ctx.fill();
    }
  }
  for (const ring of slice.outline) {
    tracePath(ring);
    ctx.strokeStyle = '#6d68c9';
    ctx.lineWidth = px(1.5);
    ctx.stroke();
  }
  if (SHOW_HINTS || !slice.image) for (const region of slice.regions) drawRegion(region, null, 'rgba(190,200,255,0.5)', 1); // mock data has no image: outlines are the only context

  if (game.phase !== 'result') return;
  const r = game.result;
  const byKey = (k) => slice.regions.find((x) => x.structure === k);
  const clicked = slice === r.guessSlice && r.clicked !== r.key && byKey(r.clicked);
  if (clicked) drawRegion(clicked, null, '#8fb0ff', 2);
  const target = byKey(r.key);
  if (target) {
    drawRegion(target, 'rgba(47,207,123,0.4)', '#2fcf7b', 2.5);
    label(r.key, ringCenter(largestRing(target.polygons)));
  }
  if (slice === r.slice && !r.hit) {
    ctx.beginPath(); // click -> nearest point of the target
    ctx.setLineDash([px(6), px(4)]);
    ctx.moveTo(...r.p);
    ctx.lineTo(...r.q);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = px(1.5);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  const onMine = slice === r.guessSlice; // solid on the slice you tapped, hollow ghost elsewhere
  ctx.beginPath();
  ctx.arc(r.p[0], r.p[1], px(8), 0, Math.PI * 2);
  if (onMine) {
    ctx.fillStyle = '#ff4d8d';
    ctx.fill();
  }
  ctx.strokeStyle = onMine ? '#fff' : 'rgba(255,77,141,0.95)';
  ctx.lineWidth = px(2);
  ctx.stroke();
}

// ---------- wiring ----------
slider.addEventListener('input', onSlide);
$('apPrev').addEventListener('click', () => { slider.stepDown(); onSlide(); });
$('apNext').addEventListener('click', () => { slider.stepUp(); onSlide(); });
canvas.addEventListener('click', onGuess); // click (not pointerdown): a scroll-drag on touch screens won't count as a guess
$('nextBtn').addEventListener('click', () => {
  if (game.scores.length >= ROUNDS) return showFinal();
  game.round = game.scores.length;
  nextRound();
});
$('view').addEventListener('click', () => goTo(shown() === game.result.guessSlice ? game.result.slice : game.result.guessSlice));

route();
setTimeout(() => data.slices.forEach(sliceImage), 300); // warm the image cache
