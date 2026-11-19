#!/usr/bin/env python3
"""Extract verification frames via FFmpeg (preferred) or OpenCV fallback + local heuristics."""

from __future__ import annotations

import argparse
import json
import math
import shutil
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SAMPLES = ROOT / "samples"
OUT = ROOT / "output" / "frames"


def find_ffmpeg() -> str | None:
    which = shutil.which("ffmpeg")
    if which:
        return which
    winget = Path.home() / "AppData/Local/Microsoft/WinGet/Packages"
    if winget.is_dir():
        found = list(winget.rglob("ffmpeg.exe"))
        if found:
            return str(found[0])
    for p in (Path("C:/ffmpeg/bin/ffmpeg.exe"), Path("C:/ProgramData/chocolatey/bin/ffmpeg.exe")):
        if p.is_file():
            return str(p)
    return None


def mean_luma(frame: np.ndarray) -> float:
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    return float(np.mean(gray))


def is_mostly_black(frame: np.ndarray, threshold: float = 12.0) -> bool:
    return mean_luma(frame) < threshold


def frame_similarity(a: np.ndarray, b: np.ndarray) -> float:
    ga = cv2.cvtColor(a, cv2.COLOR_BGR2GRAY)
    gb = cv2.cvtColor(b, cv2.COLOR_BGR2GRAY)
    if ga.shape != gb.shape:
        gb = cv2.resize(gb, (ga.shape[1], ga.shape[0]))
    # Normalized correlation-ish via absolute diff
    diff = np.mean(cv2.absdiff(ga, gb))
    return float(max(0.0, 1.0 - diff / 255.0))


def extract_with_opencv(video: Path, dest: Path) -> dict:
    cap = cv2.VideoCapture(str(video))
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open {video}")
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    fps = float(cap.get(cv2.CAP_PROP_FPS) or 10) or 10
    duration = frame_count / fps if frame_count else 0

    # Indices: first 2s, middle, last 2s, plus distributed samples
    targets: list[tuple[str, int]] = []
    if frame_count <= 0:
        raise RuntimeError(f"No frames in {video}")

    first_end = min(frame_count - 1, max(1, int(fps * 2)))
    last_start = max(0, frame_count - max(1, int(fps * 2)))
    mid = frame_count // 2

    for i, idx in enumerate(sorted({0, first_end // 2, first_end})):
        targets.append((f"t_first_{i}", idx))
    targets.append(("t_mid", mid))
    for i, idx in enumerate(sorted({last_start, (last_start + frame_count - 1) // 2, frame_count - 1})):
        targets.append((f"t_last_{i}", idx))
    # Distributed
    for i in range(5):
        idx = int(i * (frame_count - 1) / 4)
        targets.append((f"t_dist_{i}", idx))

    # Dedupe by index preserving labels
    seen = set()
    unique_targets = []
    for label, idx in targets:
        if idx in seen:
            continue
        seen.add(idx)
        unique_targets.append((label, idx))

    saved = []
    frames_by_label = {}
    for label, idx in unique_targets:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ok, frame = cap.read()
        if not ok or frame is None:
            continue
        out_path = dest / f"{video.stem}__{label}__f{idx:05d}.jpg"
        cv2.imwrite(str(out_path), frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
        entry = {
            "label": label,
            "index": idx,
            "path": str(out_path),
            "meanLuma": mean_luma(frame),
            "opencvBlack": is_mostly_black(frame),
        }
        saved.append(entry)
        frames_by_label[label] = frame
    cap.release()

    # Frozen heuristic: high similarity across consecutive distributed frames
    sims = []
    ordered = sorted(saved, key=lambda x: x["index"])
    for i in range(1, len(ordered)):
        a = cv2.imread(ordered[i - 1]["path"])
        b = cv2.imread(ordered[i]["path"])
        if a is None or b is None:
            continue
        sims.append(frame_similarity(a, b))
    frozen_like = bool(sims) and float(np.mean(sims)) > 0.985 and len(set(round(s["meanLuma"], 1) for s in ordered)) <= 2

    black_ratio = sum(1 for s in saved if s["opencvBlack"]) / max(1, len(saved))

    return {
        "tool": "opencv",
        "video": str(video),
        "fps": fps,
        "frameCount": frame_count,
        "durationSec": duration,
        "frames": saved,
        "opencvHints": {
            "blackFrameRatio": black_ratio,
            "likelyFullyBlack": black_ratio >= 0.85,
            "avgSimilarity": float(np.mean(sims)) if sims else None,
            "likelyFrozen": frozen_like,
        },
    }


def extract_with_ffmpeg(video: Path, dest: Path, ffmpeg: str) -> dict | None:
    """Pull a sparse set of JPEGs with ffmpeg select filters; fall back if it fails."""
    # Use fps filter to grab ~1 fps worth for short clips, then keep named copies via OpenCV indexing.
    # For POC reliability we still use OpenCV for precise first/mid/last labeling after dump.
    tmp = dest / f"_ffmpeg_tmp_{video.stem}"
    if tmp.exists():
        shutil.rmtree(tmp, ignore_errors=True)
    tmp.mkdir(parents=True, exist_ok=True)
    pattern = str(tmp / "frame_%04d.jpg")
    cmd = [
        ffmpeg,
        "-y",
        "-i",
        str(video),
        "-vf",
        "fps=2",
        "-q:v",
        "3",
        pattern,
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True)
    except Exception as exc:  # noqa: BLE001
        print(f"[warn] ffmpeg extract failed: {exc}", file=sys.stderr)
        shutil.rmtree(tmp, ignore_errors=True)
        return None

    dumped = sorted(tmp.glob("frame_*.jpg"))
    if not dumped:
        shutil.rmtree(tmp, ignore_errors=True)
        return None

    # Reuse OpenCV path for structured labeling from original video; keep note that ffmpeg worked.
    result = extract_with_opencv(video, dest)
    result["tool"] = "ffmpeg+opencv"
    result["ffmpegDumpedFrames"] = len(dumped)
    shutil.rmtree(tmp, ignore_errors=True)
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--video", action="append", default=[], help="Specific video path(s)")
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)

    videos = [Path(v) for v in args.video] if args.video else sorted(SAMPLES.glob("sample_*.mp4"))
    if not videos:
        print("No sample videos found. Run generate_sample_assets.py first.", file=sys.stderr)
        return 1

    ffmpeg = find_ffmpeg()
    reports = []
    for video in videos:
        dest = OUT / video.stem
        dest.mkdir(parents=True, exist_ok=True)
        # Clear previous jpgs for this video
        for old in dest.glob("*.jpg"):
            old.unlink()
        if ffmpeg:
            report = extract_with_ffmpeg(video, dest, ffmpeg) or extract_with_opencv(video, dest)
        else:
            report = extract_with_opencv(video, dest)
        reports.append(report)
        (dest / "extract-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")

    summary_path = OUT / "extract-summary.json"
    summary_path.write_text(
        json.dumps({"ffmpeg": ffmpeg, "videos": reports}, indent=2),
        encoding="utf-8",
    )
    print(json.dumps({"ok": True, "ffmpeg": ffmpeg, "count": len(reports), "summary": str(summary_path)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
