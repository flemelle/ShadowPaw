# Acknowledgements

Assets intégrés dans `public/assets/` (voir `src/assets/*.zip` pour les packs
originaux — exclus du dépôt via `.gitignore`, conservés en local pour référence).

## Musique — AlkaKrab, *10 Medieval Tracks Music Pack*

Boucles utilisées telles quelles (dossier `Loops/ogg`), une piste par zone/menu :

| Fichier livré | Piste originale | Usage |
|---|---|---|
| `audio/music/menu.ogg` | 1. Moonspire | Menu principal |
| `audio/music/zone1.ogg` | 3. Darkwood Path | Zone 1 — Les Portes de Velkhar |
| `audio/music/zone2.ogg` | 4. Frostbound | Zone 2 — L'Antre de Velours Noir |
| `audio/music/zone3.ogg` | 2. Winds of Valor | Zone 3 — Velkhar, le Foyer des Ombres |
| `audio/music/zone4.ogg` | 10. Elven Dawn | Zone 4 — Seikūji, le Temple de la Quiétude |
| `audio/music/zone5.ogg` | 9. Sorrow's Edge | Zone 5 — Seikūji Corrompu (réutilisée pour la Fin B, en leitmotiv) |
| `audio/music/zone6.ogg` | 7. Mystic Grove | Zone 6 — Les Jardins Oubliés |
| `audio/music/zone7.ogg` | 6. Silverbrook | Zone 7 — La Salle des Miroirs |
| `audio/music/zone8.ogg` | 8. Throne of Storms | Zone 8 — Le Vide entre les Deux (boss final) |
| `audio/music/ending_a.ogg` | 5. Emberlight | Fin A — L'Équilibre Retrouvé |

**Licence (AlkaKrab Music License Agreement)** : usage commercial et non
commercial autorisé sans royalties (jeux vidéo, vidéos, etc.), crédit apprécié
mais non requis. Interdit : revente/redistribution des pistes brutes en tant
que pack audio autonome, upload brut sur des plateformes de streaming. Notre
usage (bande-son intégrée au jeu) est explicitement permis.

## SFX — *400 Sounds Pack*

29 sons sélectionnés sur les ~400 fournis (`public/assets/audio/sfx/`), renommés
par usage : `ui_*` (menus), `dialog_advance`, `power_unlock`, `combo_trigger`,
`puzzle_solved` / `puzzle_fail`, `shard_collect`, `boss_defeated`, `pivot_sting`
/ `pivot_absorb` (pivot Acte 1 → 2), `zone_transition`, `dash`, `shadow_form`,
`pause_open` / `pause_close`, `ending_positive` / `ending_negative`,
`footstep_gravel_1..4` (Acte 1) et `footstep_grass_1..4` (Acte 2).

Aucun fichier de licence explicite n'était inclus dans ce pack — **à vérifier
par l'utilisateur** avant toute distribution publique/commerciale du jeu.

## Décors parallax — *Free Pixel Art Forest* (Eder Muniz)

12 calques (`public/assets/images/backgrounds/forest/`), utilisés en zones 1
(Les Portes de Velkhar) et 6 (Les Jardins Oubliés).

**Licence** : usage personnel et commercial autorisé, modification autorisée,
**crédit obligatoire** (fait ici + dans l'écran Crédits du menu),
redistribution du fichier (même modifié) en tant qu'asset interdite. Proche
d'une CC BY 4.0 sans droit de revente.

## Décors parallax + tileset — *Stringstar Fields*

3 calques (`public/assets/images/backgrounds/stringstar/`) utilisés en zones 4,
5, 7, 8 (Seikūji et ses abords). Le `tileset.png` (props décoratifs) a aussi
été découpé (`scripts/gen-zones.mjs` / analyse manuelle) en 5 sprites de décor
(`public/assets/images/decor/`, sans collision, dispersés dans les zones ayant
un décor peint — cf. `LevelLoader.scatterDecor`) : `tree_big`, `tree_small`,
`bush_round`, `rock`, `platform_plank`. Une bande de sol (`tiles/ground_stringstar.png`)
en a aussi été extraite comme base des textures de sol/plateformes par zone
(`tiles/floor_zone1..8.png`, générées hors-ligne et teintées par
`scripts/gen-floor-textures.py`), remplaçant les aplats de couleur générés
précédemment.

Aucune licence explicite fournie avec le pack (readme informel de
remerciement aux acheteurs/Patreons) — **à vérifier par l'utilisateur** avant
toute distribution publique/commerciale.

## Décors + décor + tileset — pack cimetière (Anokolisa)

4 calques (`public/assets/images/backgrounds/graveyard/`, lune/nuages, silhouette
d'église et cimetière, buissons/pierres tombales) utilisés en zones 1, 2 et 3
(Domaine de Velkhar) — en bien plus haute résolution (768×416 et plus) que les
packs précédents, remplaçant l'accord Forest/vide utilisé jusque-là pour ces
zones. Deux sprites de décor en ont aussi été extraits
(`images/decor/graveyard_statue.png`, `graveyard_brush.png`) et un tileset
pierre/fer forgé (`images/tiles/graveyard_tileset.png`, non encore exploité en
tuiles de gameplay).

**Licence (`Social/Autor_note.txt` du pack)** : usage commercial et non
commercial libre, crédit apprécié mais non obligatoire — sauf recolorisation/
modification de forme, où même le crédit optionnel saute. Nos calques ont été
recadrés mais pas recolorés.

## Notes

- Les sprites de **personnage** (joueur) et tout ce qui relève du **combat**
  restent générés procéduralement (`BootScene.ts`) : aucun asset de ce type
  n'a été intégré, conformément au périmètre du projet. Les marqueurs de zone
  et les tuiles de gate (breakable/hidden/dash/shadow/light) restent aussi
  procéduraux, pour rester visuellement distincts des textures de sol.
- Tous les fichiers sources (zips) sont ignorés par git (`.gitignore`) pour ne
  pas redistribuer les packs bruts ; seuls les fichiers effectivement utilisés
  par le jeu sont commités, dans `public/assets/`.

## Mobs/PNJ/créatures réels et UI — ajouts ultérieurs

Contrairement à la note ci-dessus, quelques sprites réels ont finalement été
intégrés pour les mobs, boss et créatures à sauver (le joueur reste procédural) :

- **UI Medieval** (`images/ui/`) — panneau bois suspendu (fond du menu Pause) et
  icônes play/pause (`panel_wood.png`, `btn_play_light.png`, `btn_pause_light.png`).
- **AllCats** (pack multi-variantes de chats "Idle") — `ThreeColorFree/IdleCatt.png`
  pour la créature piégée à sauver (`images/creatures/rescue_cat_idle.png`) ;
  `BlackCat`, `Brown`, `White` pour les chats sauvages décoratifs dispersés sur
  la carte (`images/decor/cat_wild_*.png`, non-traversables mais sans interaction).
- **SedentaryCats** (`.aseprite`, rastérisé par un script maison faute d'outil
  Aseprite disponible) — chat-ombre assis, mob des zones au décor STRINGSTAR
  (`images/creatures/mob_cat.png`).
- **Free - Raven Fantasy Icons** — crâne, mob des zones GRAVEYARD et de la zone 8
  (décor abstrait) (`images/creatures/skull_enemy.png`).
- **Legacy Fantasy - High Forest 2.0** — sanglier, mob de la zone Forêt
  (`images/creatures/boar_idle.png`).
- **MediavelFree.png / Idle.png** — chatte-ninja, boss "L'Ombre Jumelle"
  (`images/bosses/catgirl_idle.png`).
- **BLUE/RED Aseprite Spritesheets** — esprit-chat spectral (bleu pour "Le Double
  de Lumière", rouge pour Malakar, boss final) (`images/bosses/ghost_cat_*.png`).
- **Pixel Art Tiles and Backgrounds - Woods** — deux touffes d'herbe ajoutées au
  pool de décor de la zone Forêt (`images/decor/forest_grass_*.png`).

Aucun de ces packs ne fournissait de licence explicite (au mieux une note de
remerciement informelle) — **à vérifier par l'utilisateur** avant toute
distribution publique/commerciale du jeu, comme pour Stringstar Fields ci-dessus.
