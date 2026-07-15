# Handoff équipe — Shadowpaw

Ce document explique comment lancer le projet et où brancher ce qui manque
encore : visuels de personnages, mobs, dynamiques de combat. Le reste (niveaux,
progression, pouvoirs, dialogues, menus, sauvegarde) est fonctionnel.

## Lancer le jeu

```bash
npm install
npm run dev        # serveur de dev, http://localhost:5173
npm run build      # build de prod dans dist/
npm run preview    # sert le build de prod localement
npm run typecheck  # tsc --noEmit seul, sans build
```

Ajouter `?admin=1` à l'URL (ex. `http://localhost:5173/?admin=1`) lance
directement le **Mode Admin** : tous les pouvoirs débloqués, aucune contrainte
de progression, accès à un sélecteur de chapitre (touche **F1** en jeu) pour
sauter à n'importe quelle zone. C'est le moyen le plus rapide d'aller
inspecter/tester une zone ou un boss précis sans reprendre depuis le début.

Rien à configurer par ailleurs : les seuls assets externes (musique/SFX/décors,
cf. `ACKNOWLEDGEMENTS.md`) sont déjà dans `public/assets/`, servis tels quels.

## Ce qui est généré à la place des visuels manquants

Personnages, mobs et dynamiques de combat sont explicitement **hors du
périmètre déjà couvert** (cf. `message.txt`, le brief d'origine). Tout ce qui
en tient lieu aujourd'hui est **généré au boot par du code**, dans
`src/scenes/BootScene.ts` — aucun fichier image de personnage n'existe dans le
repo. C'est là qu'il faut remplacer les silhouettes par du vrai art plutôt que
de chercher un fichier à éditer.

| Clé (`TEX.*`, `src/utils/Constants.ts`) | Généré par (`BootScene.ts`) | Représente aujourd'hui | À remplacer par |
|---|---|---|---|
| `PLAYER` | `generatePlayerTexture()` | Kiba en jeu : rectangle 22×30, moitié grise / moitié violette + un œil | Sprite + feuille d'animation du joueur (idle/run/jump/attaque) |
| `PLAYER_GLOW` | `generateGlowTexture()` | Halo de lumière autour de Kiba dans les zones sombres (`DARK_ZONES`) | Garder tel quel, ou remplacer par un vrai effet de particules si le nouveau sprite le justifie |
| `PLAYER_PORTRAIT` | `generatePortraitTextures()` | Grande silhouette de Kiba (220×360) affichée à gauche pendant les dialogues (`DialogScene`) et les tutoriels (`TutorialScene`) | Portrait illustré du personnage |
| `NPC` | `generateMarkerTexture(TEX.NPC, 0x4ac9e0, 'circle')` | Marqueur **générique** (simple cercle cyan) pour **tous** les PNJ en jeu, quel que soit le PNJ | Un sprite par PNJ (voir tableau des PNJ ci-dessous — actuellement ils partagent tous ce même cercle, rien ne les distingue visuellement) |
| `NPC_PORTRAIT` | `generatePortraitTextures()` | Grande silhouette **générique** (moine encapuchonné, yeux cyan) affichée à droite pendant les dialogues, réutilisée pour **tous** les PNJ | Un portrait par PNJ, comme pour le sprite en jeu |
| `BOSS_ARENA` | `generateMarkerTexture(TEX.BOSS_ARENA, 0xd63b3b, 'diamond')` | Marqueur générique (losange rouge) pour l'arène de **chaque** boss ; le combat lui-même n'est pas simulé (victoire actée directement à l'interaction, cf. `GameScene.handleBossArena`) | Sprite/scène de boss + la dynamique de combat elle-même (actuellement absente : pas de PV, pas d'attaques, pas de pattern) |
| `ZONE_EXIT` | `generateMarkerTexture(..., 'arrow')` | Sortie de zone | Probablement à garder tel quel (élément d'UI, pas un personnage) |
| `PUZZLE_TRIGGER` | `generateMarkerTexture(..., 'square')` | Déclencheur de puzzle (Acte 2) | Idem, UI |
| `POWER_ALTAR` | `generateMarkerTexture(..., 'star')` | Autel de pouvoir | Idem, UI — ou un vrai décor d'autel si vous voulez le sortir du "marqueur" |
| `SHARD` | `generateMarkerTexture(..., 'shard')` | Éclat de Hikari no Ne à ramasser (Acte 2) | Idem, UI/collectible |
| `BREAKABLE` / `HIDDEN` / `DASH_GATE` / `SHADOW_WALL` / `LIGHT_OBSTACLE` | `generateTileTexture(...)` | Tuiles de gate liées aux pouvoirs (parois cassables, passages cachés, grilles, murs d'ombre, obstacles de lumière) | Tuiles de décor cohérentes avec le reste (cf. `public/assets/images/tiles/`), gardées volontairement distinctes visuellement pour rester lisibles en gameplay |
| `PARTICLE` | inline dans `create()` | Particule générique (petit disque blanc) | Peut rester tel quel, ou être remplacé par un sprite de particule dédié |

**Astuce** : tous les personnages/marqueurs ci-dessus sont des textures Phaser
générées via `graphics.generateTexture(clé, w, h)` — pour les remplacer, le
plus simple est de précharger un vrai fichier image sous la **même clé** dans
`BootScene.preload()` (comme c'est déjà fait pour les décors/tuiles de sol,
cf. `DECOR_PATHS`/`ZONE_FLOOR_TEX` dans `Constants.ts`) et de supprimer l'appel
`generate*()` correspondant. Aucun autre fichier n'a besoin de changer : tout
le reste du code référence uniquement la clé (`TEX.PLAYER`, etc.), jamais un
chemin de fichier.

## PNJ existants (tous partagent le même marqueur/portrait générique)

Chaque PNJ est juste une entité `"type": "npc"` dans `src/data/maps/zoneX.json`
avec un champ `dialogTree` pointant vers `src/data/dialogues.json`. Le champ
`npc` dans `dialogues.json` est un identifiant texte libre, pas encore relié à
une texture précise — c'est le point d'accroche naturel si vous voulez donner
un sprite/portrait distinct par PNJ (ex. un `Record<string, string>` id PNJ →
clé de texture, consulté par `NPC.ts`/`DialogScene.ts` à la place de la
constante unique `TEX.NPC`/`TEX.NPC_PORTRAIT`).

| id `npc` | Nom affiché | Apparaît dans | Rôle |
|---|---|---|---|
| `tozen` | Tozen, le Moine | Zones 1, 2, 3 | Mentor récurrent, gardien mystérieux du Clan |
| `ryo_spirit` | L'Esprit de Ryo | Zone 3 | Maître de Kiba, apparaît sous forme spectrale |
| `veilleur_seikuji` | Le Veilleur de Seikūji | Zone 4 | Gardien du temple, lore sur Hikari no Ne |
| `echo_hikari` | L'Écho de Hikari | Zones 5, 6 | Fragment de la Source, guide de l'Acte 2 |
| `reflet` | ??? (Un reflet) | Zone 7 | Entité des miroirs, annonce le boss de la zone |
| `malakar` | Malakar, Sensei de l'Ombre | Zone 8 | Antagoniste principal, dialogue de choix de fin |

## Boss existants (arène = marqueur seul, combat non implémenté)

| `bossId` | Zone | Pouvoir accordé |
|---|---|---|
| `boss_gardien_de_pierre` | 1 | Griffes renforcées |
| `boss_maitre_aveugle` | 2 | Vision féline |
| `boss_ombre_jumelle` | 3 | Dash fantôme |
| `boss_velkhar_ancien` | 4 | Forme ombre |
| `boss_jardinier_corrompu` | 6 | — |
| `boss_double_de_lumiere` | 7 | — (nécessite le combo `lame_duale`) |
| `boss_malakar_final` | 8 | — (boss final, 3 phases prévues dans `message.txt`, non modélisées) |

`GameScene.handleBossArena()` (dans `src/scenes/GameScene.ts`) est l'endroit
exact où la "victoire" est actée sans combat — c'est le point d'entrée pour
brancher une vraie boucle de combat (PV, attaques, phases) le jour où celle-ci
existe.

## Autres fichiers utiles pour situer le contenu

- `message.txt` — brief de conception d'origine (zones, pouvoirs, boss, fins).
- `src/data/powers.json` — nom/icône/effet de chaque pouvoir (déjà réutilisé
  tel quel par les tutoriels de pouvoir, cf. `TutorialContent.ts`).
- `src/data/dialogues.json` — tous les arbres de dialogue.
- `src/data/maps/zone*.json` — layout de chaque zone + entités (spawn, PNJ,
  boss, autels, sorties, puzzles).
- `ACKNOWLEDGEMENTS.md` — provenance/licence de chaque asset déjà intégré.
