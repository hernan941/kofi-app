"""Generates every Kofi icon PNG and the iOS layer from the vector sources in assets/brand/.

Run from anywhere: python3 tools/assets/generate-brand-assets.py

Needs Python with Pillow and headless Chromium (set CHROMIUM to override /usr/bin/chromium).
Sources:
- kofi-mark.svg: full color figure.
- kofi-glyph.svg: one-color simplified figure, with eyes and muzzle as holes.

Each figure is rendered at 4096 px, trimmed to what the output needs and downscaled, so the
result does not depend on Chromium's small-size antialiasing. Adaptive layers are checked
against the Android safe zone, and the notification icon against its 4 px margin.
"""

import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
BRAND = ROOT / "assets" / "brand"
IMAGES = ROOT / "assets" / "images"
IOS_LAYER = ROOT / "assets" / "expo.icon" / "Assets" / "kofi-mark.svg"
CHROMIUM = os.environ.get("CHROMIUM", "/usr/bin/chromium")

BACKGROUND = "#D5E3EA"
OUTLINE_WIDTH = 36
UNITS = 1024
RENDER = 4096

REFERENCE_RADIUS = 404.0
SQUARE_CENTER_Y = 522.0
ADAPTIVE_CENTER_Y = 492.0
SPLASH_CENTER_Y = 512.0
SAFE_ZONE = 66 / 108


def inner(svg_name: str) -> str:
    """Returns the shapes of a source SVG, without its root element."""
    text = (BRAND / svg_name).read_text(encoding="utf-8")
    return text[text.index(">") + 1 : text.rindex("</svg>")]


def outlined_mark() -> str:
    """Returns the mark with a pale sticker outline, for dark backgrounds."""
    shapes = inner("kofi-mark.svg")
    start = shapes.index(' d="', shapes.index('id="head"')) + 4
    head = shapes[start : shapes.index('"', start)]
    outline = (
        f'<path d="{head}" fill="{BACKGROUND}" stroke="{BACKGROUND}" '
        f'stroke-width="{OUTLINE_WIDTH * 2}" stroke-linejoin="round"/>'
    )
    return outline + shapes


def render(shapes: str) -> Image.Image:
    """Rasterizes shapes drawn in the 1024-unit space on a transparent 4096 px canvas."""
    with tempfile.TemporaryDirectory() as folder:
        page = Path(folder) / "page.html"
        shot = Path(folder) / "shot.png"
        page.write_text(
            "<!doctype html><style>html,body{margin:0;background:transparent;overflow:hidden}"
            "svg{display:block}</style>"
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{UNITS}" height="{UNITS}" '
            f'viewBox="0 0 {UNITS} {UNITS}">{shapes}</svg>',
            encoding="utf-8",
        )
        subprocess.run(
            [
                CHROMIUM,
                "--headless",
                "--disable-gpu",
                "--hide-scrollbars",
                "--force-color-profile=srgb",
                f"--user-data-dir={folder}/profile",
                "--default-background-color=00000000",
                f"--force-device-scale-factor={RENDER // UNITS}",
                f"--window-size={UNITS},{UNITS}",
                f"--screenshot={shot}",
                page.as_uri(),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        image = Image.open(shot).convert("RGBA")
    if image.size != (RENDER, RENDER):
        raise SystemExit(f"Unexpected Chromium screenshot size: {image.size}")
    return image


def place(figure: Image.Image, size: int, coverage: float, center_y: float) -> Image.Image:
    """Crops a square around (512, center_y) where the reference circle spans `coverage`.

    The center differs per output: squares use the middle of the head and circular masks a higher
    point, so the ears keep their distance from the edge.
    """
    ratio = RENDER / UNITS
    half = REFERENCE_RADIUS / coverage * ratio
    middle_x, middle_y = UNITS / 2 * ratio, center_y * ratio
    box = (middle_x - half, middle_y - half, middle_x + half, middle_y + half)
    left, top, right, bottom = (round(value) for value in box)
    square = Image.new("RGBA", (right - left, bottom - top), (0, 0, 0, 0))
    square.paste(figure, (-left, -top))
    return square.resize((size, size), Image.LANCZOS)


def solid(size: int) -> Image.Image:
    return Image.new("RGBA", (size, size), BACKGROUND)


def assert_safe_zone(image: Image.Image) -> None:
    """Fails if any visible pixel falls outside Android's adaptive icon safe circle."""
    side = image.width
    limit = side * SAFE_ZONE / 2
    middle = (side - 1) / 2
    alpha = image.getchannel("A").load()
    for y in range(side):
        for x in range(side):
            if alpha[x, y] > 16 and (x - middle) ** 2 + (y - middle) ** 2 > limit**2:
                raise SystemExit(f"Pixel {x},{y} is outside the adaptive safe zone")


def white(image: Image.Image) -> Image.Image:
    """Forces pure white RGB and keeps only the alpha of the figure."""
    result = Image.new("RGBA", image.size, (255, 255, 255, 0))
    result.putalpha(image.getchannel("A"))
    return result


def notification(glyph: Image.Image) -> Image.Image:
    """Fits the glyph in the 88 px box of the 96 px canvas and checks its free margin."""
    trimmed = glyph.crop(glyph.getchannel("A").getbbox())
    scale = 88 / max(trimmed.size)
    fitted = trimmed.resize(tuple(round(side * scale) for side in trimmed.size), Image.BOX)
    canvas = Image.new("RGBA", (96, 96), (255, 255, 255, 0))
    canvas.paste(fitted, ((96 - fitted.width) // 2, (96 - fitted.height) // 2))
    left, top, right, bottom = canvas.getchannel("A").getbbox()
    if min(left, top, 96 - right, 96 - bottom) < 4:
        raise SystemExit("The notification icon does not keep 4 px free on every side")
    return white(canvas)


def save(image: Image.Image, name: str) -> None:
    image.save(IMAGES / name, optimize=True)
    print(f"Wrote {IMAGES / name} {image.size} {image.mode}")


def main() -> None:
    mark = render(inner("kofi-mark.svg"))
    glyph = render(inner("kofi-glyph.svg"))

    icon = solid(1024)
    icon.alpha_composite(place(mark, 1024, 0.78, SQUARE_CENTER_Y))
    save(icon.convert("RGB"), "icon.png")

    foreground = place(mark, 512, 0.575, ADAPTIVE_CENTER_Y)
    assert_safe_zone(foreground)
    save(foreground, "android-icon-foreground.png")
    save(solid(512).convert("RGB"), "android-icon-background.png")

    monochrome = white(place(glyph, 432, 0.575, ADAPTIVE_CENTER_Y))
    assert_safe_zone(monochrome)
    save(monochrome, "android-icon-monochrome.png")

    save(notification(glyph), "notification-icon.png")
    save(place(mark, 1024, 0.84, SPLASH_CENTER_Y), "splash-icon.png")
    outlined = render(outlined_mark())
    save(place(outlined, 1024, 0.84, SPLASH_CENTER_Y), "splash-icon-dark.png")

    shutil.copyfile(BRAND / "kofi-mark.svg", IOS_LAYER)
    print(f"Wrote {IOS_LAYER}")


if __name__ == "__main__":
    main()
