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


def normalize(hexcolor: int, target_max: int = 235) -> tuple[int, int, int]:
    """Garde la teinte de `hexcolor` mais remonte son canal max à `target_max` : les
    couleurs de ZONE_AMBIANCE sont pensées comme un voile sombre (wash), pas comme un
    multiplicateur — les appliquer telles quelles écrasait le sol/les plateformes à une
    luminance proche de 0, illisible sur n'importe quel fond (cf. plainte contraste)."""
    r = (hexcolor >> 16) & 0xFF
    g = (hexcolor >> 8) & 0xFF
    b = hexcolor & 0xFF
    mx = max(r, g, b, 1)
    factor = target_max / mx
    return (min(255, round(r * factor)), min(255, round(g * factor)), min(255, round(b * factor)))


def tint(im: Image.Image, rgb: tuple[int, int, int]) -> Image.Image:
    """Recolore par la LUMINANCE du pixel source (pas ses canaux) : la texture de base est
    un vert/bleu terreux qui n'a quasiment aucun rouge, donc multiplier canal-à-canal ne
    peut jamais produire un sol doré/violet (le rouge cible retombe toujours à ~0). Utiliser
    la luminance comme facteur commun conserve le relief (pierres/mortier) tout en laissant
    la couleur de zone s'exprimer pleinement."""
    r, g, b = rgb
    im = im.convert('RGBA')
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            pr, pg, pb, pa = px[x, y]
            lum = (0.2126 * pr + 0.7152 * pg + 0.0722 * pb) / 255
            px[x, y] = (round(r * lum), round(g * lum), round(b * lum), pa)
    return im


def main() -> None:
    src = Image.open(SRC).convert('RGBA')
    base = src.crop((0, 0, TILE, 18)).resize((TILE, TILE), Image.NEAREST)
    base = ImageEnhance.Contrast(base).enhance(1.3)
    # Le crop source est très sombre (canal max ~87/255) ; boost fort pour que la texture ait
    # une vraie plage de luminance (mortier sombre / pierre claire) à restituer via tint().
    base = ImageEnhance.Brightness(base).enhance(4.2)

    for name, color in ZONE_TINTS.items():
        tinted = tint(base.copy(), normalize(color))
        tinted.save(f'{OUT_DIR}/floor_{name}.png')
        print(name, 'done')


if __name__ == '__main__':
    main()
