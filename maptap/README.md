# BrainTap (prototype)

```bash
npm install
npm run dev        # http://localhost:5173  (ships with 2 mock slices)
npm test           # unit tests (reads public/slices.json, or DATA=path)
npm run build
```

## Game

- 3 rounds, 25 / 35 / 40 points, levels `[1]`, `[2,3]`, `[4,5]` (`ROUND_PTS`, `ROUND_LEVELS` in `src/main.js`).
- Pick an AP slice with the slider, click the target. Score decreases linearly with the 3D distance (mm) from your guess
  (AP from your slice, ML/DV from your click) to the closest point of the target across all slices; 0 at `falloffMm` (2.0, in slices.json).
- Wrong answers jump to the correct slice, highlight the target and draw a line to its nearest point; a button toggles back to your slice.
- Daily puzzle: seeded by the UTC date (`src/daily.js`). URL params: `?date=YYYY-MM-DD`, `?practice` (random, replayable), `?hints` (show boundaries).

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
