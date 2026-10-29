#!/usr/bin/env python3
"""Allen CCFv3 -> public/slices.json + public/slices/*.jpg for Brain MapTap.

  python tools/build_slices.py                 # real atlas (BrainGlobe downloads it once)
  python tools/build_slices.py --synthetic     # offline self-test on a fake volume

Region list + difficulty: tools/regions.csv (acronym, level). Each listed structure is
rasterised as the union of itself and all its descendants, so parents may overlap children.
"""
import argparse
import csv
import json
import sys
from pathlib import Path

import cv2
import numpy as np

BREGMA_AP_UM = 5400   # CCFv3: distance (um) from anterior edge of the volume to Bregma. Approximate.
MIN_PRESENCE = 30     # voxels a structure needs in a slice to count as "present" at that AP
FALLOFF_MM = 2.0        # score reaches 0 at this 3D distance (mm) from the target


# ---------------------------------------------------------------- atlas
def load_atlas(res):
    from brainglobe_atlasapi import BrainGlobeAtlas

    atlas = BrainGlobeAtlas(f"allen_mouse_{res}um")
    assert atlas.orientation == "asr", f"unexpected orientation {atlas.orientation}"
    return atlas


class FakeAtlas:
    """Tiny stand-in with the same interface (annotation, reference, structures, resolution)."""

    resolution = (100, 100, 100)
    orientation = "asr"

    def __init__(self):
        tree = [
            (1, "root", "root", [1]),
            (10, "Isocortex", "Isocortex", [1, 10]),
            (11, "MOp", "Primary motor area", [1, 10, 11]),
            (111, "MOp5", "Primary motor area, Layer 5", [1, 10, 11, 111]),
            (12, "MOs", "Secondary motor area", [1, 10, 12]),
            (20, "HIP", "Hippocampal region", [1, 20]),
            (21, "CA1", "Field CA1", [1, 20, 21]),
            (30, "CP", "Caudoputamen", [1, 30]),
        ]
        self.structures = {}
        for i, acr, name, path in tree:
            s = {"id": i, "acronym": acr, "name": name, "structure_id_path": path, "rgb_triplet": [i * 7 % 256, 120, 200]}
            self.structures[i] = self.structures[acr] = s
        a, d, m = np.indices((60, 40, 60))
        brain = ((a - 30) / 28) ** 2 + ((d - 20) / 18) ** 2 + ((m - 30) / 26) ** 2 < 1
        ann = np.where(brain, 1, 0).astype(np.uint32)
        ann[brain & (d < 12) & (a < 35)] = 111
        ann[brain & (d < 12) & (a >= 35)] = 12
        ann[brain & (a > 25) & (a < 45) & (d > 14) & (d < 20) & (abs(m - 30) > 8) & (abs(m - 30) < 18)] = 21
        ann[brain & (a < 30) & (d > 22) & (d < 32) & (abs(m - 30) > 10) & (abs(m - 30) < 20)] = 30
        self.annotation = ann
        rng = np.random.default_rng(0)
        self.reference = (brain * 3000 + rng.integers(0, 500, ann.shape)).astype(np.uint16)


SYNTHETIC_LEVELS = {"Isocortex": 1, "HIP": 1, "CP": 1, "MOp": 2, "MOs": 2, "CA1": 3, "MOp5": 5}


# ---------------------------------------------------------------- geometry
def contours(mask, eps):
    """External contours of a boolean mask, simplified (Douglas-Peucker), as int [[x, y], ...] rings."""
    cs, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    rings = []
    for c in cs:
        approx = cv2.approxPolyDP(c, eps, True)[:, 0, :]
        if len(approx) >= 3:
            rings.append(approx.tolist())
    return rings


# ---------------------------------------------------------------- build
def build(atlas, levels, step_um, eps, out_dir, jpeg_q=80):
    res = int(atlas.resolution[0])
    ann, ref = atlas.annotation, atlas.reference
    n_ap, H, W = ann.shape
    step = max(1, round(step_um / res))
    step_mm = step * res / 1000

    # curated structures that exist in this atlas
    S = {}
    for acr in levels:
        try:
            S[acr] = atlas.structures[acr]
        except KeyError:
            print(f"warn: '{acr}' not in atlas, skipped", file=sys.stderr)
    acrs = list(S)

    # membership[k, j]: does annotation label uniq[j] belong to curated structure k (self or descendant)?
    uniq = np.unique(ann)  # includes 0 so searchsorted maps background correctly
    member = np.zeros((len(acrs), len(uniq)), bool)
    for j, u in enumerate(uniq):
        try:
            path = set(atlas.structures[int(u)]["structure_id_path"])
        except KeyError:
            continue
        for k, a in enumerate(acrs):
            member[k, j] = S[a]["id"] in path

    # global contrast window for the template images
    sample = ref[::4, ::2, ::2]
    lo, hi = np.percentile(sample[sample > 0], [1, 99.5])

    out_dir = Path(out_dir)
    (out_dir / "slices").mkdir(parents=True, exist_ok=True)
    slices, presence = [], {a: [] for a in acrs}

    for i in range(0, n_ap, step):
        sl = ann[i]
        if not sl.any():
            continue
        ap = round((BREGMA_AP_UM - i * res) / 1000, 2)
        idx = np.searchsorted(uniq, sl)
        cand = np.flatnonzero(member[:, np.unique(idx)].any(axis=1))
        regions = []
        for k in cand:
            mask = member[k][idx]
            area = int(mask.sum())
            rings = contours(mask, eps)
            if rings:
                regions.append({"structure": acrs[k], "polygons": rings})
                presence[acrs[k]].append((ap, area))

        img = np.clip((ref[i].astype(np.float32) - lo) / (hi - lo), 0, 1) * 255
        name = f"slices/ap_{ap:+.2f}.jpg"
        cv2.imwrite(str(out_dir / name), img.astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, jpeg_q])
        slices.append({"id": f"ap_{ap:+.2f}", "bregma": ap, "image": name,
                       "outline": contours(sl > 0, eps * 1.5), "regions": regions})

    # per-structure AP extent, derived from where it is actually present
    structures = {}
    for a in acrs:
        pres = [(ap, ar) for ap, ar in presence[a] if ar >= MIN_PRESENCE]
        if not pres:
            continue
        aps = [p[0] for p in pres]
        structures[a] = {
            "name": S[a]["name"],
            "level": levels[a],
            "color": "#%02x%02x%02x" % tuple(int(c) for c in S[a]["rgb_triplet"]),
            "apRange": [round(min(aps) - step_mm / 2, 2), round(max(aps) + step_mm / 2, 2)],
            "peak": max(pres, key=lambda t: t[1])[0],
            # for calibrating tools/regions.csv levels against measurements
            "peakAreaMm2": round(max(ar for _, ar in pres) * (res / 1000) ** 2, 3),
            "apSpanMm": round(max(aps) - min(aps) + step_mm, 2),
        }
    for s in slices:
        s["regions"] = [r for r in s["regions"] if r["structure"] in structures]

    data = {
        "meta": {"atlas": f"Allen CCFv3 {res}um", "bregmaApUm": BREGMA_AP_UM, "unitUm": res, "stepMm": step_mm},
        "canvas": [int(W), int(H)],
        "apRange": [slices[-1]["bregma"], slices[0]["bregma"]],
        "scoring": {"falloffMm": FALLOFF_MM},
        "structures": structures,
        "slices": slices,
    }
    validate(data)
    (out_dir / "slices.json").write_text(json.dumps(data, separators=(",", ":")))
    return data


def validate(d):
    W, H = d["canvas"]
    assert d["slices"], "no slices"
    for s in d["slices"]:
        for ring in s["outline"] + [p for r in s["regions"] for p in r["polygons"]]:
            assert len(ring) >= 3
            assert all(0 <= x <= W and 0 <= y <= H for x, y in ring), "ring outside canvas"
        for r in s["regions"]:
            assert r["structure"] in d["structures"], r["structure"]
    for a, st in d["structures"].items():
        lo, hi = st["apRange"]
        assert lo < hi and st["level"] in range(1, 6), a


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--res", type=int, default=25, choices=[10, 25, 50, 100])
    ap.add_argument("--step-um", type=int, default=100, help="AP spacing between exported slices")
    ap.add_argument("--eps", type=float, default=0.8, help="polygon simplification tolerance (voxels)")
    ap.add_argument("--regions", default="tools/regions.csv")
    ap.add_argument("--out", default="public")
    ap.add_argument("--synthetic", action="store_true")
    a = ap.parse_args()

    if a.synthetic:
        atlas, levels = FakeAtlas(), SYNTHETIC_LEVELS
    else:
        atlas = load_atlas(a.res)
        levels = {r["acronym"]: int(r["level"]) for r in csv.DictReader(open(a.regions))}

    data = build(atlas, levels, a.step_um, a.eps, a.out)
    n_reg = sum(len(s["regions"]) for s in data["slices"])
    print(f"{len(data['slices'])} slices, {len(data['structures'])} structures, {n_reg} region entries -> {a.out}/slices.json")


if __name__ == "__main__":
    main()
