"""Optimize the approved 星潮棲境 background for the PWA."""

from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "art-concepts" / "luminous-star-tide-habitat-v1.png"
OUTPUT = ROOT / "public" / "art" / "growth" / "luminous-habitat-star-tide.webp"


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(SOURCE) as image:
        optimized = ImageOps.fit(image.convert("RGB"), (1280, 720), method=Image.Resampling.LANCZOS)
        optimized.save(OUTPUT, "WEBP", quality=86, method=6)


if __name__ == "__main__":
    main()
