# BrainTap (prototype)

```bash
npm install
npm run dev        # http://localhost:5173  (ships with 2 mock slices)
npm test           # unit tests (reads public/slices.json, or DATA=path)
npm run build
```

## Game

- 3 rounds, 25 / 35 / 40 points, levels `[1]`, `[2,3]`, `[4,5]` (`src/config.js`).
- Pick an AP slice with the slider (or the arrow buttons), tap the target. Score decreases linearly with the 3D distance (mm) from your guess
  (AP from your slice, ML/DV from your tap) to the closest point of the target across all slices; 0 at `FALLOFF_MM` (4.0, `src/config.js`).
- After a guess the slider stays free: browse any slice, the target stays highlighted; a button jumps between the correct slice and yours.
- Daily puzzle: seeded by the UTC date (`src/daily.js`), one play per day. Refreshing mid-game resumes at the same round.
- Profiles: saved in the browser's localStorage (`src/store.js`): history, streaks, day/week/month charts, backup code to export/import. No server.
- URL params: `?date=YYYY-MM-DD` (open a specific day, for testing), `?hints` (draw region outlines).

## Customise

- **Name:** `APP_NAME` in `src/config.js`. Also change `<title>` in `index.html`. Leave `STORAGE_KEY` alone or players lose their stats.
- **Your artwork:** drop SVG/PNG files in `public/art/`, name them in `ART` in `src/config.js`, and add credits to `CREDITS`.
- **Colours / type:** CSS variables at the top of `src/style.css`. Font: Fredoka (self-hosted via `@fontsource-variable/fredoka`, no external requests).

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
