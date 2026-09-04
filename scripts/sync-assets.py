#!/usr/bin/env python3
"""Sync saq_assets_ready → public/assets with safe renames and bg cleanup.

Source of truth: saq_assets_ready/
Does not modify or delete files inside saq_assets_ready.
"""

from __future__ import annotations

import shutil
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
READY = ROOT / "saq_assets_ready"
PUBLIC = ROOT / "public" / "assets"
PROCESSED = PUBLIC / "npc" / "processed"


def soft_remove_flat_bg(
    src: Path,
    dst: Path,
    bg_rgb: tuple[int, int, int] = (232, 232, 232),
    bg_tol: int = 18,
    max_bg_alpha: int = 235,
) -> None:
    """Remove flat gray/white matte without cutting opaque white shirts."""
    im = np.array(Image.open(src).convert("RGBA"), dtype=np.int16)
    rgb = im[:, :, :3]
    a = im[:, :, 3]
    dist = np.abs(rgb - np.array(bg_rgb)[None, None, :]).max(axis=2)
    bg = (dist <= bg_tol) & (a < max_bg_alpha)
    near_white = (
        (rgb[:, :, 0] > 220)
        & (rgb[:, :, 1] > 220)
        & (rgb[:, :, 2] > 220)
        & (a < max_bg_alpha)
    )
    kill = bg | near_white
    out = im.astype(np.uint8).copy()
    out_a = out[:, :, 3].astype(np.float32)
    out_a[kill] = 0
    fringe = (dist <= bg_tol + 10) & (a < 250) & ~kill
    out_a[fringe] *= 0.15
    out[:, :, 3] = out_a.astype(np.uint8)

    ys, xs = np.where(out[:, :, 3] > 8)
    if len(xs):
        pad = 4
        x0, x1 = max(0, xs.min() - pad), min(out.shape[1], xs.max() + pad + 1)
        y0, y1 = max(0, ys.min() - pad), min(out.shape[0], ys.max() + pad + 1)
        out = out[y0:y1, x0:x1]

    dst.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(out, "RGBA").save(dst, optimize=True)
    print(f"processed {src.name} -> {dst.relative_to(ROOT)} ({out.shape[1]}x{out.shape[0]})")


def normalize_player(src: Path, dst: Path, target_h: int = 400) -> bool:
    im = Image.open(src).convert("RGBA")
    if im.height < 180:
        print(f"SKIP tiny {src.name} {im.size}")
        return False
    scale = target_h / im.height
    nw = max(1, int(round(im.width * scale)))
    out = im.resize((nw, target_h), Image.Resampling.LANCZOS)
    arr = np.array(out)
    ys, xs = np.where(arr[:, :, 3] > 10)
    if len(xs):
        pad = 2
        x0, x1 = max(0, xs.min() - pad), min(arr.shape[1], xs.max() + pad + 1)
        out = out.crop((x0, 0, x1, target_h))
    dst.parent.mkdir(parents=True, exist_ok=True)
    out.save(dst, optimize=True)
    print(f"player {src.name} -> {out.size}")
    return True


def main() -> None:
    if not READY.is_dir():
        raise SystemExit(f"Missing source pack: {READY}")

    PROCESSED.mkdir(parents=True, exist_ok=True)

    # Pair with known semi-opaque white matte
    soft_remove_flat_bg(
        READY / "npc" / "npc_students_group.png",
        PROCESSED / "npc_pair_walking.png",
    )
    shutil.copy2(PROCESSED / "npc_pair_walking.png", PUBLIC / "npc" / "npc_pair_walking.png")

    renames = [
        (
            READY / "npc" / "npc_students_group_standing&talking.png",
            PUBLIC / "npc" / "npc_group_assembly.png",
        ),
        (
            READY / "npc" / "npc_students_group_walk.png",
            PUBLIC / "npc" / "npc_group_evacuating.png",
        ),
    ]
    for src, dst in renames:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        print(f"copied {src.name} -> {dst.name}")

    old = PUBLIC / "npc" / "npc_group_walking.png"
    if old.exists():
        old.unlink()
        print("removed legacy npc_group_walking.png")

    for name in [
        "npc_student_boy_idle.png",
        "npc_student_boy_pointing.png",
        "npc_student_boy_walk.png",
        "npc_student_girl_confused.png",
        "npc_student_girl_idle.png",
        "npc_student_girl_pointing.png",
        "npc_student_girl_walk.png",
        "npc_teacher_idle.png",
        "npc_teacher_walk.png",
    ]:
        shutil.copy2(READY / "npc" / name, PUBLIC / "npc" / name)

    for sub in ("effects", "objects"):
        for f in (READY / sub).glob("*.png"):
            if "sheet_source" in f.name:
                continue
            dest = PUBLIC / sub / f.name
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(f, dest)

    bg_map = {
        "classroom_start.png": "classroom_start.jpg",
        "corridor_main.png": "corridor_main.jpg",
        "stairs_emergency.png": "stairs_emergency.jpg",
        "exit_assembly.png": "exit_assembly.jpg",
    }
    # Hand-authored production backgrounds (not in saq_assets_ready).
    # Never delete/overwrite these during sync.
    preserve_backgrounds = {
        "central_hall_empty.png",
        "vestibule_empty.png",
    }
    for src_name, dst_name in bg_map.items():
        if dst_name in preserve_backgrounds:
            print(f"SKIP preserve bg {dst_name}")
            continue
        im = Image.open(READY / "backgrounds" / src_name).convert("RGB")
        im = im.resize((1280, 720), Image.Resampling.LANCZOS)
        out = PUBLIC / "backgrounds" / dst_name
        out.parent.mkdir(parents=True, exist_ok=True)
        im.save(out, quality=90, optimize=True)
        print(f"bg {dst_name}")

    for name in sorted(preserve_backgrounds):
        path = PUBLIC / "backgrounds" / name
        if path.exists():
            print(f"preserve bg {name} ({path.stat().st_size} bytes)")
        else:
            print(f"WARN missing preserved bg: {name}")

    for f in sorted((READY / "player").glob("player_*.png")):
        if "sheet" in f.name:
            continue
        # Walk frames 3–4 historically have white mattes; production uses 1–2 only.
        if any(f.name.endswith(suf) for suf in ("_3.png", "_4.png")) and "walk" in f.name:
            print(f"SKIP white-mat walk frame {f.name}")
            continue
        normalize_player(f, PUBLIC / "player" / f.name)

    # Production front idle: корневой файл побеждает ready-пак.
    override_front = ROOT / "player_idle_front.png"
    if override_front.exists():
        dest = PUBLIC / "player" / "player_idle_front.png"
        shutil.copy2(override_front, dest)
        print(f"override player_idle_front <- {override_front.name}")

    print("sync-assets: done")


if __name__ == "__main__":
    main()
