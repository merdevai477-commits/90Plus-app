#!/usr/bin/env python3
"""Compute black/frozen heuristics for a folder of JPEG frames."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import cv2
import numpy as np


def mean_luma(frame: np.ndarray) -> float:
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    return float(np.mean(gray))


def similarity(a: np.ndarray, b: np.ndarray) -> float:
    ga = cv2.cvtColor(a, cv2.COLOR_BGR2GRAY)
    gb = cv2.cvtColor(b, cv2.COLOR_BGR2GRAY)
    if ga.shape != gb.shape:
        gb = cv2.resize(gb, (ga.shape[1], ga.shape[0]))
    diff = float(np.mean(cv2.absdiff(ga, gb)))
    return max(0.0, 1.0 - diff / 255.0)


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "usage: opencv_frame_metrics.py <frames_dir>"}))
        return 1
    folder = Path(sys.argv[1])
    paths = sorted(folder.glob("*.jpg")) + sorted(folder.glob("*.png"))
    if not paths:
        print(json.dumps({"ok": False, "error": "no_frames"}))
        return 0

    frames = []
    metrics = []
    for p in paths:
        img = cv2.imread(str(p))
        if img is None:
            continue
        frames.append(img)
        luma = mean_luma(img)
        metrics.append(
            {
                "file": p.name,
                "meanLuma": luma,
                "opencvBlack": luma < 12.0,
                "shape": list(img.shape),
            }
        )

    sims = []
    for i in range(1, len(frames)):
        sims.append(similarity(frames[i - 1], frames[i]))

    black_ratio = sum(1 for m in metrics if m["opencvBlack"]) / max(1, len(metrics))
    avg_sim = float(np.mean(sims)) if sims else None
    result = {
        "ok": True,
        "frameCount": len(metrics),
        "frames": metrics,
        "blackFrameRatio": black_ratio,
        "likelyFullyBlack": black_ratio >= 0.85,
        "avgSimilarity": avg_sim,
        "likelyFrozen": bool(avg_sim is not None and avg_sim > 0.985 and len(metrics) >= 2),
    }
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
