#!/usr/bin/env python3
"""Generate synthetic MP4 samples + still frames for the Gemini verification POC."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SAMPLES = ROOT / "samples"
FRAMES = ROOT / "output" / "frames"


def find_ffmpeg() -> str | None:
    which = shutil.which("ffmpeg")
    if which:
        return which
    # Common winget install locations on Windows
    candidates = [
        Path.home() / "AppData/Local/Microsoft/WinGet/Packages",
        Path("C:/ffmpeg/bin/ffmpeg.exe"),
        Path("C:/ProgramData/chocolatey/bin/ffmpeg.exe"),
    ]
    for base in candidates:
        if base.is_file():
            return str(base)
        if base.is_dir():
            found = list(base.rglob("ffmpeg.exe"))
            if found:
                return str(found[0])
    return None


def write_video(path: Path, frames: list[np.ndarray], fps: int = 10) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    h, w = frames[0].shape[:2]
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(path), fourcc, fps, (w, h))
    if not writer.isOpened():
        raise RuntimeError(f"Failed to open VideoWriter for {path}")
    for frame in frames:
        writer.write(frame)
    writer.release()


def footballish_frame(w: int = 640, h: int = 360, t: int = 0) -> np.ndarray:
    img = np.zeros((h, w, 3), dtype=np.uint8)
    img[:, :] = (34, 139, 34)  # pitch green (BGR)
    # center circle
    cv2.circle(img, (w // 2, h // 2), 50, (255, 255, 255), 2)
    # moving "ball"
    x = 80 + (t * 12) % (w - 160)
    y = h // 2 + int(30 * np.sin(t / 3))
    cv2.circle(img, (x, y), 12, (255, 255, 255), -1)
    # simple "player" rectangle
    cv2.rectangle(img, (x - 40, y - 40), (x - 20, y), (0, 0, 200), -1)
    cv2.putText(img, "90Plus POC pitch", (16, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    return img


def black_frame(w: int = 640, h: int = 360) -> np.ndarray:
    return np.zeros((h, w, 3), dtype=np.uint8)


def error_frame(w: int = 640, h: int = 360) -> np.ndarray:
    img = np.zeros((h, w, 3), dtype=np.uint8)
    cv2.putText(img, "Video unavailable", (80, h // 2 - 20), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2)
    cv2.putText(img, "in your country", (110, h // 2 + 30), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (200, 200, 255), 2)
    return img


def loading_frame(w: int = 640, h: int = 360, t: int = 0) -> np.ndarray:
    img = np.zeros((h, w, 3), dtype=np.uint8)
    img[:, :] = (20, 20, 20)
    cv2.putText(img, "Loading...", (220, h // 2), cv2.FONT_HERSHEY_SIMPLEX, 1.1, (220, 220, 220), 2)
    cv2.circle(img, (w // 2, h // 2 + 50), 18, (180, 180, 180), 2)
    angle = (t * 30) % 360
    cv2.ellipse(img, (w // 2, h // 2 + 50), (18, 18), angle, 0, 90, (100, 200, 255), 3)
    return img


def frozen_pair() -> list[np.ndarray]:
    base = footballish_frame(t=5)
    return [base.copy() for _ in range(20)]


def maybe_reencode_ffmpeg(src: Path, dest: Path, ffmpeg: str | None) -> Path:
    if not ffmpeg:
        return src
    dest.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        ffmpeg,
        "-y",
        "-i",
        str(src),
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-an",
        str(dest),
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True)
        return dest
    except Exception as exc:  # noqa: BLE001
        print(f"[warn] ffmpeg re-encode failed for {src.name}: {exc}", file=sys.stderr)
        return src


def main() -> int:
    SAMPLES.mkdir(parents=True, exist_ok=True)
    FRAMES.mkdir(parents=True, exist_ok=True)
    ffmpeg = find_ffmpeg()
    manifest = {"ffmpeg": ffmpeg, "videos": [], "stills": []}

    # Still frames for image tests
    stills = {
        "still_black.png": black_frame(),
        "still_football.png": footballish_frame(t=8),
        "still_error.png": error_frame(),
        "still_loading.png": loading_frame(t=2),
    }
    for name, frame in stills.items():
        path = SAMPLES / name
        cv2.imwrite(str(path), frame)
        manifest["stills"].append(str(path))

    # Videos
    football_frames = [footballish_frame(t=i) for i in range(40)]  # ~4s @10fps
    black_frames = [black_frame() for _ in range(30)]
    error_frames = [error_frame() for _ in range(20)]
    loading_frames = [loading_frame(t=i) for i in range(25)]
    frozen_frames = frozen_pair()
    # Mixed: black start, football middle, black end
    mixed = [black_frame() for _ in range(8)] + [footballish_frame(t=i) for i in range(20)] + [black_frame() for _ in range(8)]

    specs = [
        ("sample_football.mp4", football_frames),
        ("sample_black.mp4", black_frames),
        ("sample_error.mp4", error_frames),
        ("sample_loading.mp4", loading_frames),
        ("sample_frozen.mp4", frozen_frames),
        ("sample_mixed.mp4", mixed),
    ]

    for name, frames in specs:
        raw = SAMPLES / f"raw_{name}"
        write_video(raw, frames, fps=10)
        final = maybe_reencode_ffmpeg(raw, SAMPLES / name, ffmpeg)
        if final != raw and raw.exists() and final.exists():
            raw.unlink(missing_ok=True)
        elif raw.exists() and not (SAMPLES / name).exists():
            raw.rename(SAMPLES / name)
            final = SAMPLES / name
        manifest["videos"].append({"name": name, "path": str(final), "frameCount": len(frames)})

    out = SAMPLES / "manifest.json"
    out.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps({"ok": True, "ffmpeg": ffmpeg, "manifest": str(out)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
