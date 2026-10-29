# BrainTap (prototype)

```bash
npm install
npm run dev        # http://localhost:5173  (ships with 2 mock slices)
npm test           # unit tests (reads public/slices.json, or DATA=path)
npm run build
```

## Game

- 3 rounds, 25 / 35 / 40 points, round 1 draws levels 1-2, round 2 level 3 + the larger half of level 4, round 3 the smaller half of level 4 + level 5 (`ROUND_RULES`) (`src/config.js`).
- Pick an AP slice with the slider (or the arrow buttons), tap the target. Score decreases linearly with the 3D distance (mm) from your guess
  (AP from your slice, ML/DV from your tap) to the closest point of the target across all slices; 0 at `FALLOFF_MM` (4.0, `src/config.js`).
- After a guess the slider stays free: browse any slice, the target stays highlighted; a button jumps between the correct slice and yours.
- Daily puzzle: seeded by the Berlin date (`src/day.js`; new slide at 00:00 Europe/Berlin, daylight saving handled), one play per day. Round 1 of the daily game is always CA1 (`fixed` in `ROUND_RULES`); practice rounds are random. Refreshing mid-game resumes at the same round.
- Local stats: browser localStorage (`src/store.js`). No account needed to play.
- Optional cloud profile: a username only (no login/email). The browser holds a recovery key (`id.secret`); the server stores only its hash. Create it on the Profile page; sign in on another device with the key.
- Groups (`#groups`): create, share the invite link (`#join/<code>`), max `GROUP_CAP` = 40 members. Day / week / month tables (total, games, average, wins). No spoilers: the server hides today's scores until the viewer has played today.
- Privacy notice at `#privacy` (`src/privacy.js`); fill in `OPERATOR` in `src/config.js`.
- URL params: `?date=YYYY-MM-DD` (open a specific day, for testing), `?hints` (draw region outlines).

## Customise

- **Name:** `APP_NAME` in `src/config.js`. Also change `<title>` in `index.html`. Leave `STORAGE_KEY` alone or players lose their stats.
- **Art page (`#art`):** put your neuron pictures in `public/art/` and list them in `GALLERY` in `src/config.js` (`file`, `title`, `alt`, `credit`, optional `href`/`caption`). Deploy and they appear. Tap a picture to enlarge it. `ART.hero` (a picture beside the home title) and `CREDITS` (footer) work the same way.
- **Colours / type:** CSS variables at the top of `src/style.css`. Font: Aptos if the visitor has it installed (it is Microsoft-licensed and cannot be hosted), otherwise Hanken Grotesk (self-hosted via `@fontsource-variable/hanken-grotesk`, no external requests).

## Build real slices from Allen CCFv3

Python >= 3.11.

```bash
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r tools/requirements.txt
python tools/build_slices.py                          # downloads atlas once, writes public/slices.json + public/slices/*.jpg
python tools/build_slices.py --step-um 50 --eps 0.6   # denser slices / finer polygons
python tools/build_slices.py --synthetic              # offline pipeline self-test
npm run dev
```

- Region list and difficulty (1-5): `tools/regions.csv` (edit `level` freely; names come from the atlas).
- Bregma: CCFv3 AP origin is the anterior edge; Bregma is set to 5.4 mm behind it (`BREGMA_AP_UM`). Approximate.
- Output also has `peakAreaMm2` / `apSpanMm` per structure to sanity-check the levels.
- Allen content on a public site: credit "Image credit: Allen Institute" with a link, and check their Terms of Use before any commercial use.

## Cloud setup (Cloudflare Worker + D1)

`worker/index.js` serves `/api/*`; everything else is the static site (`wrangler.jsonc`: `run_worker_first: ["/api/*"]`).

```bash
npx wrangler login
npx wrangler d1 create braintap --jurisdiction=eu     # EU data location can only be chosen at creation
# paste the printed database_id into wrangler.jsonc
npx wrangler d1 execute braintap --remote --file=worker/schema.sql
npm run build && npx wrangler deploy
```

Local test of everything: `npx wrangler d1 execute braintap --local --file=worker/schema.sql`, then `npm run build && npx wrangler dev --local`.
`npm test` also runs the Worker against an in-memory SQLite stand-in for D1.

Known limits: results are submitted by the browser, so a determined player can fake a score (fine for friends; not for prizes). No rate limiting yet (Cloudflare WAF rate-limit rules can be added in the dashboard).
