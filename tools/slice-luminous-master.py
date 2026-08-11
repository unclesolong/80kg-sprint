"""Build the twelve production 潤光 stage assets from the approved master sheet."""

from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "art-concepts" / "luminous-lv01-lv12-neutral-master-v1.png"
OUTPUT = ROOT / "public" / "art" / "growth"


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with Image.open(SOURCE) as image:
        if image.size != (1536, 1024):
            raise ValueError(f"Unexpected master size: {image.size}")

        # ImageGen kept a clean grid but gave the mature column extra room. The
        # detected separators are recorded explicitly so the large final form
        # is never clipped by assuming four mathematically equal columns.
        column_edges = [0, 357, 718, 1078, image.width]
        row_edges = [0, 353, 666, image.height]

        # The master is arranged by body family in columns. Each family grows
        # from top to bottom, so the runtime level order is column-major.
        level = 1
        for column in range(4):
            for row in range(3):
                left, right = column_edges[column], column_edges[column + 1]
                top, bottom = row_edges[row], row_edges[row + 1]
                if left:
                    left += 2
                if top:
                    top += 2
                if right < image.width:
                    right -= 2
                if bottom < image.height:
                    bottom -= 2
                cell = image.crop((left, top, right, bottom))
                corner_colors = [
                    cell.getpixel((0, 0)),
                    cell.getpixel((cell.width - 1, 0)),
                    cell.getpixel((0, cell.height - 1)),
                    cell.getpixel((cell.width - 1, cell.height - 1)),
                ]
                background = tuple(
                    sum(color[channel] for color in corner_colors) // len(corner_colors)
                    for channel in range(3)
                )
                fitted = ImageOps.contain(cell, (640, 400), method=Image.Resampling.LANCZOS)
                tile = Image.new("RGB", (640, 400), background)
                tile.paste(fitted, ((tile.width - fitted.width) // 2, (tile.height - fitted.height) // 2))
                tile.save(
                    OUTPUT / f"luminous-stage-{level:02d}.webp",
                    "WEBP",
                    quality=88,
                    method=6,
                )
                level += 1


if __name__ == "__main__":
    main()
