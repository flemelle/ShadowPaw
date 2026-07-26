#!/usr/bin/env python3
"""One-off generator: bakes 8 per-zone floor/platform textures from a ground texture
SOURCED FROM THE SAME PACK AS EACH ZONE'S PAINTED BACKGROUND (cf. ZONE_SRC below) —
Stringstar Fields' own ground for its zones, "Pixel Art Woods Tileset" for the forest
zone. The graveyard pack (Anokolisa) has no plain repeatable ground tile — only scenic
silhouette props (cf. graveyard_tileset.png) — so graveyard zones still fall back to the
Stringstar ground rather than an unrelated look; cf. ACKNOWLEDGEMENTS.md for all sources.

Each zone's tint is derived from the *actual painted background it uses* rather than
a hand-picked accent color: the dominant color of that background's farthest (sky)
layer, composited with the zone's own ambiance wash (must mirror src/utils/Constants.ts
ZONE_BACKGROUND/ZONE_AMBIANCE — see BG_LAYER/ZONE_WASH below) — so platforms/ground read
as belonging to their backdrop instead of standing out as an unrelated accent color.
Run with: python3 scripts/gen-floor-textures.py
"""
from PIL import Image, ImageEnhance

BG_DIR = 'public/assets/images/backgrounds'
OUT_DIR = 'public/assets/images/tiles'
TILE = 32

# Source ground crop per zone — cf. module docstring for why graveyard falls back to Stringstar.
ZONE_SRC = {
    'zone1': f'{OUT_DIR}/ground_stringstar.png',
    'zone2': f'{OUT_DIR}/ground_stringstar.png',
    'zone3': f'{OUT_DIR}/ground_stringstar.png',
    'zone4': f'{OUT_DIR}/ground_stringstar.png',
    'zone5': f'{OUT_DIR}/ground_stringstar.png',
    'zone6': f'{OUT_DIR}/ground_forest.png',
    'zone7': f'{OUT_DIR}/ground_stringstar.png',
    'zone8': f'{OUT_DIR}/ground_stringstar.png',
}

# Farthest (sky) layer per background set — cf. ParallaxBackground.ts, lowest scrollFactor —
# since it's the one fully-opaque layer that covers the whole frame and best represents
# what the player reads as "the background's color", unlike small foreground silhouettes.
BG_SKY_LAYER = {
    'forest': f'{BG_DIR}/forest/layer_11.png',
    'stringstar': f'{BG_DIR}/stringstar/layer_00.png',
    'graveyard': f'{BG_DIR}/graveyard/layer_00.png',
}

# Must mirror src/utils/Constants.ts ZONE_BACKGROUND (bg set, or None = no painted
# background, cf. zone8) and ZONE_AMBIANCE (washColor, washAlpha).
ZONE_WASH = {
    'zone1': ('graveyard', 0x4a2f7a, 0.12),
    'zone2': ('graveyard', 0x0a0712, 0.35),
    'zone3': ('graveyard', 0x6a1f6a, 0.22),
    'zone4': ('stringstar', 0xffe9b0, 0.10),
    'zone5': ('stringstar', 0x3a1f5c, 0.28),
    'zone6': ('forest', 0x2a4a2a, 0.22),
    'zone7': ('stringstar', 0x3a5f8a, 0.20),
    # Pas de décor peint : le voile de couleur EST le fond (cf. ZONE_BACKGROUND.zone8 = null).
    'zone8': (None, 0x0a0612, 0.40),
}


def dominant_color(path: str, n_colors: int = 12) -> tuple[int, int, int]:
    """Couleur la plus fréquente de l'image (quantifiée sur une petite palette), en
    ignorant les pixels transparents — une vraie couleur "majoritaire", pas une moyenne
    que quelques pixels très clairs/sombres pourraient tirer n'importe où."""
    im = Image.open(path).convert('RGBA')
    pixels = [(r, g, b) for r, g, b, a in im.getdata() if a > 10]
    strip = Image.new('RGB', (len(pixels), 1))
    strip.putdata(pixels)
    quant = strip.quantize(colors=n_colors, method=Image.MEDIANCUT)
    palette = quant.getpalette()
    counts = sorted(quant.getcolors(), reverse=True)
    _, top_idx = counts[0]
    return tuple(palette[top_idx * 3:top_idx * 3 + 3])


def composite(base: tuple[int, int, int], wash_hex: int, wash_alpha: float) -> int:
    """Alpha-compose le voile de couleur de la zone par-dessus la couleur dominante de son
    fond (même opération que le rectangle semi-transparent de ParallaxBackground.wash)."""
    wr, wg, wb = (wash_hex >> 16) & 0xFF, (wash_hex >> 8) & 0xFF, wash_hex & 0xFF
    br, bg, bb = base
    r = round(wr * wash_alpha + br * (1 - wash_alpha))
    g = round(wg * wash_alpha + bg * (1 - wash_alpha))
    b = round(wb * wash_alpha + bb * (1 - wash_alpha))
    return (r << 16) | (g << 8) | b


def compute_zone_tints() -> dict[str, int]:
    bg_dominant = {name: dominant_color(path) for name, path in BG_SKY_LAYER.items()}
    tints = {}
    for zone, (bg_set, wash_hex, wash_alpha) in ZONE_WASH.items():
        base = bg_dominant[bg_set] if bg_set else ((wash_hex >> 16) & 0xFF, (wash_hex >> 8) & 0xFF, wash_hex & 0xFF)
        tints[zone] = composite(base, wash_hex, wash_alpha)
    return tints


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


def load_base(src_path: str) -> Image.Image:
    """Prépare le crop source en tuile 32x32 prête à teinter. Le crop Stringstar est une bande
    fine (128x18) très sombre, recadrée/étirée puis boostée pour restituer une vraie plage de
    luminance (mortier sombre / pierre claire) ; les autres sources sont déjà des tuiles 32x32
    correctement contrastées (vrai tileset), pas besoin du même traitement correctif."""
    src = Image.open(src_path).convert('RGBA')
    if src_path.endswith('ground_stringstar.png'):
        base = src.crop((0, 0, TILE, 18)).resize((TILE, TILE), Image.NEAREST)
        base = ImageEnhance.Contrast(base).enhance(1.3)
        return ImageEnhance.Brightness(base).enhance(4.2)
    return src.resize((TILE, TILE), Image.NEAREST) if src.size != (TILE, TILE) else src


def main() -> None:
    bases = {zone: load_base(path) for zone, path in ZONE_SRC.items()}
    for name, color in compute_zone_tints().items():
        tinted = tint(bases[name].copy(), normalize(color))
        tinted.save(f'{OUT_DIR}/floor_{name}.png')
        print(name, f'0x{color:06x}', 'done')


if __name__ == '__main__':
    main()
