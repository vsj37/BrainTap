# BrainTap

A daily mouse-brain anatomy game, in the spirit of MapTap. Every day (new slide at **00:00 Europe/Berlin**) the whole world gets the same 3 brain regions. For each one you pick a **coronal slice** with an AP slider, then tap where the region is. Your score drops with the 3D distance to the region. Share the result, keep stats, and compare with friends in private groups.

Live: deployed on Cloudflare Workers (see [Deploying](#deploying)). Brain slices come from the **Allen Mouse Common Coordinate Framework (CCFv3)**.

> **For a new contributor or a new Claude chat:** read this whole file once. Sections [Architecture](#architecture), [Decisions and why](#decisions-and-why), [Gotchas](#gotchas) and [Roadmap](#roadmap) hold the context that is not obvious from the code.

---

## Game rules (as implemented)

- 3 rounds worth **25 / 35 / 40** points (100 total).
- **Round 1 of the daily game is always CA1.** Round 2 draws from level 3 + the *larger half* of level 4; round 3 from the *smaller half* of level 4 + level 5 (`ROUND_RULES` in `src/config.js`; "larger" = peak cross-section area from the atlas build, A-Z if no area data). Practice rounds ignore the CA1 rule and use levels 1-2 for round 1.
- Score = `maxPts * max(0, 1 - dist3 / FALLOFF_MM)` with `FALLOFF_MM = 4.0`. `dist3` is the 3D distance from the guess (AP from the chosen slice, ML/DV from the tap) to the **closest point of the target region across all slices**. Code: `scoreGuess`, `closest3D` in `src/logic.js`.
- After a guess the slider stays free, the correct slice and your slice can be browsed, and a short fun fact / neuro pun / neuroscientist story appears (`src/facts.js`).
- **One daily play per day**; the daily puzzle is seeded by the Berlin date (xmur3 + mulberry32). Puzzle #1 = 2026-10-19 (`EPOCH` in `src/daily.js`). Practice rounds are unlimited and don't count.
- Share text: `BrainTap #N · date`, total, 🟩🟨🟥 squares (>=0.9 / >=0.5 / lower), per-round scores.
- New players see the How to play page once before their first game.

## Features

- Play, **Stats** (day/week/month charts, streaks), **Profile** (optional cloud profile), **Groups**, **Art** gallery, **How to play**, **Privacy** notice.
- Side-view minimap (sagittal brain picture or generated outline) with a rectangle showing the current slice; after a guess it also shows the target's AP range.
- Dark mode (auto + footer switch), mobile-first layout, the Next button is pinned to the bottom on phones.
- No cookies, no analytics, no third-party requests (fonts are self-hosted).

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173 (uses public/slices.json)
npm test           # node --test: unit tests + Worker tests (needs Node 22+ for node:sqlite)
npm run build      # -> dist/
```

Local full stack (site + API + local D1):

```bash
npx wrangler d1 execute braintap --local --file=worker/schema.sql
npm run build && npx wrangler dev --local     # serves the site and /api/* together
```

Useful URL params: `?date=YYYY-MM-DD` (play a specific day; also disables the countdown), `?hints` (draw region outlines). Note: the cloud API always uses the **real** Berlin date, so `?date=` only works for local-only play.

## Repo layout

```
index.html            page shell (nav, views, footer, early theme script)
src/
  main.js             router, game loop, canvas drawing, home/stats/profile views
  config.js           EVERYTHING you tweak: name, points, round rules, falloff, group caps, art, gallery, credits, privacy operator, side image
  logic.js            pure geometry + scoring (point-in-polygon, closest3D, scoreGuess)
  daily.js            seeded puzzle: dailyKey (Berlin date), buildPools, pickRounds, shareText
  day.js              berlinDay(), msUntilBerlinMidnight()  (shared by browser and Worker)
  store.js            local stats: history, streaks, series for charts, sanitize, mergeHistory
  api.js              fetch client for /api, cloud identity in localStorage
  account.js          create profile / sign in with recovery key / rename / export / delete UI
  groups.js           group list, create, join by invite link, leaderboard (day/week/month)
  sidemap.js          side-view minimap (picture or generated outline)
  facts.js            fun facts per region + puns + neuroscientist stories
  howto.js            How to play page
  art.js              Art gallery (images, GIFs, mp4/webm)
  privacy.js          privacy notice (template; fill OPERATOR in config.js)
  theme.js, ui.js, chart.js, style.css
worker/
  index.js            Cloudflare Worker: the whole /api (D1)
  schema.sql          D1 schema
test/                 node:test suites (logic, daily, store, facts, sidemap, worker)
tools/
  build_slices.py     builds public/slices.json (+ slice images) from the Allen atlas
  regions.csv         list of regions and difficulty level 1-5 (edit freely)
public/
  slices.json         slice data (see Data format)
  art/                your pictures/videos + mouse-brain-lateral.png (side view)
wrangler.jsonc        Worker config (assets, D1 binding)
```

## Architecture

**Frontend:** Vite 7 + vanilla JS + Canvas. No framework. DOM is built with the `h()` helper in `src/ui.js` using text nodes (never `innerHTML` for user data). Hash routing: `#` home, `#stats`, `#profile`, `#groups`, `#g/<groupId>`, `#join/<code>`, `#art`, `#how`, `#privacy`, `#play`.

**Backend:** one Cloudflare Worker (`worker/index.js`) with D1 (SQLite). Static assets are served by the assets binding; only `/api/*` runs the Worker (`assets.run_worker_first: ["/api/*"]` in `wrangler.jsonc`). Required binding names: `DB` (D1) and `ASSETS`.

**Identity (no login):** `POST /api/profile` creates a player (username only) and returns a recovery key `id.secret`. The browser stores it; the server stores only `sha256(secret)`. Requests send `Authorization: Bearer <key>` (header auth, so no CSRF). Signing in on another device = pasting the key.

**API (all JSON):**
`POST /api/profile`, `GET|PATCH|DELETE /api/me`, `PUT /api/results/:day` (today only), `POST /api/results` (bulk import of past days), `GET|POST /api/groups`, `GET /api/groups/preview?code=`, `POST /api/groups/join`, `GET|DELETE /api/groups/:id`, `POST /api/groups/:id/leave`, `DELETE /api/groups/:id/members/:playerId`.

**Groups:** invite by link (`#join/<10-char code>`), capped at `GROUP_CAP = 40` with an atomic `INSERT ... SELECT ... WHERE count < cap`. Leaderboards: day table (per-round scores) and week/month standings (Total / Games / Avg / Wins). **No spoilers:** the server hides *today's* scores from members who have not played today (the UI only renders what it receives).

**Data format (`public/slices.json`)** (produced by `tools/build_slices.py`): `canvas [W,H]`, `apRange [min,max]` (mm from Bregma, + = anterior), `meta {unitUm, stepMm, ...}`, `structures {acronym: {name, level, apRange, peak, peakAreaMm2, apSpanMm}}`, `slices [{id, bregma, outline: [rings], regions: [{structure, polygons: [rings]}]}]`, `scoring {falloffMm}`. Coordinates are in atlas voxel units (`unitUm` µm each). The repo's copy may be mock data; rebuild with the Python tool.

## Building real slices

Python >= 3.11.

```bash
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r tools/requirements.txt
python tools/build_slices.py                          # downloads atlas once, writes public/slices.json + public/slices/*.jpg
python tools/build_slices.py --step-um 50 --eps 0.6   # denser slices / finer polygons
python tools/build_slices.py --synthetic              # offline pipeline self-test
```

Bregma is approximated as 5.4 mm behind the CCFv3 anterior edge (`BREGMA_AP_UM`). Region difficulty is in `tools/regions.csv`.

## Deploying

Hosted on **Cloudflare Workers** from this GitHub repo.

- If the project lives in a subfolder (ours is `app/`), set Cloudflare *Root directory* to it. Build command `npm run build`, deploy command `npx wrangler deploy`.
- One-time database setup:
  ```bash
  npx wrangler login
  npx wrangler d1 create braintap --jurisdiction=eu     # EU data location can only be chosen at creation
  # paste the printed database_id into wrangler.jsonc (binding name must be "DB")
  npx wrangler d1 execute braintap --remote --file=worker/schema.sql
  ```
- Manual deploy from a computer: `npm run build && npx wrangler deploy`.
- Public address is the account's `workers.dev` subdomain; a custom domain can be attached under the Worker's Domains & Routes.

## Customising

- **Name:** `APP_NAME` in `src/config.js` and `<title>` in `index.html`. Do **not** change `STORAGE_KEY` / `CLOUD_KEY` (players would lose local data).
- **Art page:** put files in `public/art/`, list them in `GALLERY` (`file` incl. extension, `title`, `alt`, `credit`, optional `href`/`caption`). Videos must be MP4 (H.264) or WebM, not `.mov`.
- **Side-view picture:** set `SIDE_IMAGE = { file, flip, x0, x1, y0, y1 }` in `src/config.js` (fractions of the picture *as displayed*, front on the right). `x0`/`x1` = back/front end of the brain, `y0`/`y1` = top/bottom. Without it, an outline is generated from the slice data. Credit the picture in `CREDITS`.
- **Fun facts:** add entries to `REGION_FACTS` (keyed by acronym from `tools/regions.csv`; `npm test` checks the keys exist).
- **Privacy notice:** fill `OPERATOR` (name, address, email) in `src/config.js` before launch.
- **Colours / fonts:** CSS variables at the top of `src/style.css` (`:root` and `:root[data-theme='dark']`).

## Decisions and why

- **Berlin midnight, not UTC:** the owner is in Germany. One shared `berlinDay()` in `src/day.js` is used by browser and Worker so "today" always agrees. DST handled via `Intl`.
- **No login, username + recovery key:** keeps friction and personal data minimal (GDPR). Downside: a lost key can't be recovered.
- **Self-hosted fonts, no external requests:** GDPR (German courts have ruled against Google Fonts embeds). Aptos can't be self-hosted (Microsoft licence), so the stack is `Aptos, Hanken Grotesk Variable, system-ui`.
- **Allen data is CC-BY-style with required credit:** the "Image credit: Allen Institute" footer line must stay on the same page as the slices.
- **No AI-generated art** (owner's rule). Own artwork or properly licensed/attributed images only. Never remove watermarks from stock images.
- **Scoring uses the closest 3D point of the region across all slices**, so a long region is easy to hit from several slices and a wrong slice is penalised by AP distance.
- **Nissl-style colouring** was preferred over raw DAPI for slice images (Zenodo 15176439, CC BY 4.0) but is not implemented yet; slices are currently flat-coloured polygons.

## Known limitations

- Results are submitted by the browser, so a determined player can fake a score (fine for friends, not for prizes). Server only validates ranges and that the day is today.
- No rate limiting (add Cloudflare WAF rate-limit rules if abused).
- Privacy notice is a template, not legal advice. Germany probably also needs an **Impressum**.
- Side-view picture calibration is an estimate; tune `x0/x1/y0/y1` against real slices.
- First-half-of-level-4 and "no spoilers" are our interpretations of the spec (see Game rules).

## Gotchas

- **`wrangler.jsonc` must live in the Root directory** Cloudflare builds from, with binding name `DB` and a full 36-char `database_id`, committed to GitHub. Mistakes here caused the error "binding DB of type d1 must have a valid database_id" for hours. If a local `wrangler deploy` works but Cloudflare's build fails, compare the committed file on GitHub and the build's commit hash.
- `npm test` needs Node >= 22 (uses `node:sqlite` as a D1 stand-in). `node --test` (no path argument) is the right invocation.
- Windows: no `printf`; create `.gitignore` with `echo` lines.
- Don't use `pkill -f` with a pattern that appears in your own shell command; it kills the shell.
- The user's `src/config.js` contains their `GALLERY`, `CREDITS`, `OPERATOR`, `SIDE_IMAGE`. When shipping updates as zips, don't overwrite it; give config snippets instead.

## Roadmap / ideas

- Run `tools/build_slices.py` against the real atlas for all regions and sanity-check difficulty levels (`peakAreaMm2`, `apSpanMm` in the output).
- Nissl/DAPI-style slice colouring, neuron art in the UI, intro screen.
- Art uploads in the browser (would need a Cloudflare R2 bucket + admin key); video thumbnails.
- Rate limiting / abuse protection, optional score verification.
- Custom domain and renaming the app.
- Group extras: leave/rename UI polish, notifications, per-group streaks.

## Credits and licence

- Brain atlas: Allen Institute, Allen Mouse Common Coordinate Framework (via BrainGlobe `allen_mouse_25um`).
- Side-view brain picture: "Mouse brain lateral view" by DBCLS, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0), via [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Mouse_brain_lateral_view.png) (cropped, flipped).
- Fonts: Hanken Grotesk via `@fontsource-variable/hanken-grotesk` (OFL).
- Code licence: choose one before opening the repo to contributors (none set yet).
