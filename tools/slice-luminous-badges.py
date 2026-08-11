"""Build the twelve production achievement badges from the approved master."""

from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "art-concepts" / "luminous-achievement-badges-master-v1.png"
OUTPUT = ROOT / "public" / "art" / "growth" / "achievements"
BADGE_IDS = [
    "first_complete_day",
    "seven_reflections",
    "first_nourishment",
    "custom_food_created",
    "varied_foods",
    "first_activity",
    "weekly_activity_rhythm",
    "body_listened",
    "sleep_observer",
    "comeback",
    "first_weekly_review",
    "cycle_matured",
]


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with Image.open(SOURCE) as image:
        if image.size != (1536, 1024):
            raise ValueError(f"Unexpected badge master size: {image.size}")

        column_edges = [0, 384, 768, 1152, image.width]
        row_edges = [0, 342, 681, image.height]

        for index, badge_id in enumerate(BADGE_IDS):
            column, row = index % 4, index // 4
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
            fitted = ImageOps.contain(cell, (256, 256), method=Image.Resampling.LANCZOS)
            tile = Image.new("RGB", (256, 256), background)
            tile.paste(fitted, ((tile.width - fitted.width) // 2, (tile.height - fitted.height) // 2))
            tile.save(OUTPUT / f"{badge_id}.webp", "WEBP", quality=90, method=6)


if __name__ == "__main__":
    main()
