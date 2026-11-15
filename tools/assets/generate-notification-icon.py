"""Generates assets/images/notification-icon.png (Android notification icon).

Run from the repository root: python3 tools/assets/generate-notification-icon.py

The icon is a 96x96 white-on-transparent silhouette of Phosphor's "Receipt" (fill weight, MIT
license), fitted in an 88x88 box (4 px free on every side). Android only reads the alpha
channel of notification icons. The two text bars are cut out of the silhouette; they are drawn
18.9 units thick (Phosphor uses 16) so every solid stroke is at least 8 px at 96 px, as
docs/design/notifications.md section 3.6 requires.
"""

from pathlib import Path

from PIL import Image, ImageDraw

CANVAS = 96
BOX = 88
SUPERSAMPLE = 8

GLYPH_LEFT, GLYPH_RIGHT = 24.0, 232.0
GLYPH_TOP, GLYPH_BOTTOM = 40.0, 215.0
CORNER_RADIUS = 16.0
SCALLOP_TOP = 201.0
BAR_LEFT, BAR_RIGHT = 80.0, 176.0
BAR_THICKNESS = 18.9
BAR_CENTERS = (102.0, 140.0)

SCALLOP_POINTS = (
    (232.0, SCALLOP_TOP),
    (232.0, 211.0),
    (192.0, 200.94),
    (160.0, 215.0),
    (128.0, 200.94),
    (96.0, 215.0),
    (64.0, 200.94),
    (24.0, 211.0),
    (24.0, SCALLOP_TOP),
)

OUTPUT = Path(__file__).resolve().parents[2] / "assets" / "images" / "notification-icon.png"


def build_mask() -> Image.Image:
    """Draws the silhouette at supersampled size and returns it as an 'L' mask."""
    size = CANVAS * SUPERSAMPLE
    scale = BOX / (GLYPH_RIGHT - GLYPH_LEFT) * SUPERSAMPLE
    glyph_height = (GLYPH_BOTTOM - GLYPH_TOP) * scale
    offset_x = (size - BOX * SUPERSAMPLE) / 2
    offset_y = (size - glyph_height) / 2

    def to_pixel(x: float, y: float) -> tuple[float, float]:
        return (
            offset_x + (x - GLYPH_LEFT) * scale,
            offset_y + (y - GLYPH_TOP) * scale,
        )

    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)

    left, top = to_pixel(GLYPH_LEFT, GLYPH_TOP)
    right, _ = to_pixel(GLYPH_RIGHT, GLYPH_TOP)
    _, middle = to_pixel(GLYPH_LEFT, SCALLOP_TOP)
    draw.rounded_rectangle(
        (left, top, right, middle),
        radius=CORNER_RADIUS * scale,
        corners=(True, True, False, False),
        fill=255,
    )
    draw.rectangle((left, top + CORNER_RADIUS * scale, right, middle), fill=255)
    draw.polygon([to_pixel(x, y) for x, y in SCALLOP_POINTS], fill=255)

    for center in BAR_CENTERS:
        half = BAR_THICKNESS / 2
        x0, y0 = to_pixel(BAR_LEFT, center - half)
        x1, y1 = to_pixel(BAR_RIGHT, center + half)
        draw.rounded_rectangle((x0, y0, x1, y1), radius=half * scale, fill=0)

    return mask.resize((CANVAS, CANVAS), Image.BOX)


def main() -> None:
    mask = build_mask()
    icon = Image.new("RGBA", (CANVAS, CANVAS), (255, 255, 255, 0))
    icon.putalpha(mask)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    icon.save(OUTPUT, optimize=True)
    print(f"Wrote {OUTPUT} {icon.size}")


if __name__ == "__main__":
    main()
