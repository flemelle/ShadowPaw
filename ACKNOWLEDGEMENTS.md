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
5, 7, 8 (Seikūji et ses abords). Le `tileset.png` (props décoratifs) est
également inclus mais pas encore découpé/utilisé en jeu.

Aucune licence explicite fournie avec le pack (readme informel de
remerciement aux acheteurs/Patreons) — **à vérifier par l'utilisateur** avant
toute distribution publique/commerciale.

## Notes

- Les sprites de gameplay (joueur, marqueurs de zone, tuiles de collision)
  restent générés procéduralement (`BootScene.ts`) : aucun asset de personnage
  ou de combat n'a été intégré, conformément au périmètre du projet.
- Tous les fichiers sources (zips) sont ignorés par git (`.gitignore`) pour ne
  pas redistribuer les packs bruts ; seuls les fichiers effectivement utilisés
  par le jeu sont commités, dans `public/assets/`.
