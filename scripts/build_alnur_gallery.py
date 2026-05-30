#!/usr/bin/env python3
"""Build the public Alnur homepage gallery from approved source photos."""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError as exc:  # pragma: no cover - friendly CLI failure
    raise SystemExit(
        "Pillow is required. Install it with: python -m pip install pillow"
    ) from exc


ROOT = Path(__file__).resolve().parents[1]
ALNUR_DIR = ROOT / "alnur"
SOURCE_DIRS = (ALNUR_DIR / "assets", ALNUR_DIR / "photo-drop")
OUTPUT_DIR = ALNUR_DIR / "gallery"
MANIFEST_PATH = ALNUR_DIR / "gallery.json"
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_DIMENSION = 1800
JPEG_QUALITY = 84
LABEL_OVERRIDES = {
    "0398_2026-05-25_011711_img_3686_41ec81bd": "Life at Alnur",
    "0393_2026-03-26_213313_img_2664_5667865a": "Children's Programs",
    "0390_2026-03-20_160932_img_2557_3f860b45": "Community Meals",
    "0389_2026-03-20_133840_img_2553_2fd6c14a": "Community Moments",
    "0365_2026-03-20_130858_img_2529_0eadc901": "Weekly Programs",
    "0310_2026-02-15_201026_img_2151_c0fcb402": "Weekly Halaqas",
    "0288_2026-02-15_194647_img_2117_9b16d834": "Sunday Halaqa",
    "0067_2025-01-19_183157_img_4220_c6f0ad36": "Youth & Learning",
    "0043_2024-03-02_184617_img_8975_be2085ea": "Community Gatherings",
}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def slugify(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")[:54] or "photo"


def parse_date(value: str) -> datetime | None:
    formats = (
        "%Y:%m:%d %H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
        "%Y%m%d",
    )
    for fmt in formats:
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    return None


def date_from_exif(path: Path) -> datetime | None:
    try:
        with Image.open(path) as image:
            exif = image.getexif()
    except Exception:
        return None

    for tag in (36867, 36868, 306):
        value = exif.get(tag)
        if isinstance(value, bytes):
            value = value.decode("utf-8", errors="ignore")
        if value:
            parsed = parse_date(str(value))
            if parsed:
                return parsed
    return None


def date_from_filename(path: Path) -> datetime | None:
    patterns = (
        r"(20\d{2})[-_](\d{2})[-_](\d{2})",
        r"(20\d{2})(\d{2})(\d{2})",
    )
    for pattern in patterns:
        match = re.search(pattern, path.stem)
        if match:
            parsed = parse_date("-".join(match.groups()))
            if parsed:
                return parsed
    return None


def photo_date(path: Path) -> datetime:
    return (
        date_from_filename(path)
        or date_from_exif(path)
        or datetime.fromtimestamp(path.stat().st_mtime)
    )


def infer_label(path: Path) -> str:
    override = LABEL_OVERRIDES.get(path.stem.lower())
    if override:
        return override

    text = " ".join(path.parts).lower()
    if "sprout" in text:
        return "Alnur Sprouts"
    if "quran" in text or "dar-ul-quran" in text or "dar_ul_quran" in text:
        return "Quran Learning"
    if "youth" in text or "ym" in text or "children" in text or "kids" in text:
        return "Youth & Learning"
    if "halaqa" in text or "fiqh" in text or "class" in text:
        return "Weekly Halaqas"
    if "meal" in text or "iftar" in text or "food" in text:
        return "Community Meals"
    if "jumuah" in text or "khutbah" in text:
        return "Jumuah"
    return "Life at Alnur"


def source_images() -> list[Path]:
    images: list[Path] = []
    for source_dir in SOURCE_DIRS:
        if not source_dir.exists():
            continue
        for path in source_dir.rglob("*"):
            if not path.is_file():
                continue
            if path.suffix.lower() not in ALLOWED_EXTENSIONS:
                continue
            if path.name.startswith("."):
                continue
            if path.stem.startswith("alnur-wix-logo"):
                continue
            images.append(path)
    return sorted(images)


def save_gallery_image(source: Path, destination: Path) -> None:
    with Image.open(source) as image:
        image = ImageOps.exif_transpose(image)
        if image.mode in ("RGBA", "LA") or (
            image.mode == "P" and "transparency" in image.info
        ):
            background = Image.new("RGB", image.size, (255, 255, 255))
            background.paste(image, mask=image.convert("RGBA").split()[-1])
            image = background
        else:
            image = image.convert("RGB")

        image.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.Resampling.LANCZOS)
        image.save(
            destination,
            "JPEG",
            quality=JPEG_QUALITY,
            optimize=True,
            progressive=True,
        )


def build() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for old_file in OUTPUT_DIR.glob("*.jpg"):
        old_file.unlink()

    photos = []
    seen_hashes: set[str] = set()
    for source in source_images():
        file_hash = sha256_file(source)
        if file_hash in seen_hashes:
            continue
        seen_hashes.add(file_hash)

        taken_at = photo_date(source)
        date_text = taken_at.strftime("%Y-%m-%d")
        label = infer_label(source)
        filename = f"{date_text}-{slugify(source.stem)}-{file_hash[:10]}.jpg"
        destination = OUTPUT_DIR / filename
        save_gallery_image(source, destination)

        photos.append(
            {
                "src": f"gallery/{filename}",
                "date": date_text,
                "label": label,
                "alt": f"{label} at Alnur Mosque Islamic Center",
                "source": str(source.relative_to(ROOT)),
            }
        )

    photos.sort(key=lambda item: (item["date"], item["src"]), reverse=True)
    manifest = {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "photoDrop": "alnur/photo-drop",
        "notes": "Add approved JPG, PNG, or WebP photos to alnur/photo-drop. GitHub Actions rebuilds this file automatically.",
        "photos": photos,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Built {len(photos)} gallery photos into {MANIFEST_PATH}")


if __name__ == "__main__":
    try:
        build()
    except Exception:
        shutil.rmtree(OUTPUT_DIR, ignore_errors=True)
        raise
