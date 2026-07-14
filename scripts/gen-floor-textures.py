#!/usr/bin/env python3
"""One-off generator: bakes 8 per-zone floor/platform textures from the
Stringstar Fields ground texture (public/assets/images/tiles/ground_stringstar.png,
itself cropped from the purchased tileset.png — cf. ACKNOWLEDGEMENTS.md),
tinted with each zone's wallTint (must mirror src/utils/Constants.ts
ZONE_AMBIANCE). Run with: python3 scripts/gen-floor-textures.py
"""
from PIL import Image, ImageEnhance

SRC = 'public/assets/images/tiles/ground_stringstar.png'
OUT_DIR = 'public/assets/images/tiles'
TILE = 32

# Must match src/utils/Constants.ts ZONE_AMBIANCE.wallTint
ZONE_TINTS = {
    'zone1': 0x6a3fb5,
    'zone2': 0x241a33,
    'zone3': 0x4a1f5c,
    'zone4': 0xb8a06a,
    'zone5': 0x8a6a8a,
    'zone6': 0x3a5c3a,
    'zone7': 0x4a7fae,
    'zone8': 0x2a2038,
}


def tint(im: Image.Image, hexcolor: int) -> Image.Image:
    r = (hexcolor >> 16) & 0xFF
    g = (hexcolor >> 8) & 0xFF
    b = hexcolor & 0xFF
    im = im.convert('RGBA')
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            pr, pg, pb, pa = px[x, y]
            px[x, y] = (pr * r // 255, pg * g // 255, pb * b // 255, pa)
    return im


def main() -> None:
    src = Image.open(SRC).convert('RGBA')
    base = src.crop((0, 0, TILE, 18)).resize((TILE, TILE), Image.NEAREST)
    base = ImageEnhance.Contrast(base).enhance(1.15)
    base = ImageEnhance.Brightness(base).enhance(1.3)

    for name, color in ZONE_TINTS.items():
        tinted = tint(base.copy(), color)
        tinted.save(f'{OUT_DIR}/floor_{name}.png')
        print(name, 'done')


if __name__ == '__main__':
    main()
