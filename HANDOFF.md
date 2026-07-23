# Handoff équipe — Shadowpaw

Ce document explique comment lancer le projet et où brancher ce qui manque
encore : les **visuels** (personnages, mobs, boss). Les dynamiques de jeu
elles-mêmes — niveaux, progression, pouvoirs, dialogues, menus, sauvegarde,
**mobs et combat de boss** — sont fonctionnelles ; seul l'art reste à greffer
par-dessus les silhouettes générées au boot.

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

Aucun fichier image de personnage/mob/boss n'existe dans le repo : tout ce qui
en tient lieu aujourd'hui est **généré au boot par du code**, dans
`src/scenes/BootScene.ts`. C'est là qu'il faut remplacer les silhouettes par du
vrai art plutôt que de chercher un fichier à éditer — les *dynamiques* (combat,
PV, patterns) existent déjà et n'ont pas besoin de changer pour ça.

| Clé (`TEX.*`, `src/utils/Constants.ts`) | Généré par (`BootScene.ts`) | Représente aujourd'hui | À remplacer par |
|---|---|---|---|
| `PLAYER` | `generatePlayerTexture()` | Kiba en jeu : rectangle 22×30, moitié grise / moitié violette + un œil | Sprite + feuille d'animation du joueur (idle/run/jump/attaque) |
| `PLAYER_GLOW` | `generateGlowTexture()` | Halo de lumière autour de Kiba dans les zones sombres (`DARK_ZONES`) | Garder tel quel, ou remplacer par un vrai effet de particules si le nouveau sprite le justifie |
| `PLAYER_PORTRAIT` | `generatePortraitTextures()` | Grande silhouette de Kiba (220×360) affichée à gauche pendant les dialogues (`DialogScene`) et les tutoriels (`TutorialScene`) | Portrait illustré du personnage |
| `NPC` | `generateMarkerTexture(TEX.NPC, 0x4ac9e0, 'circle')` | Marqueur **générique** (simple cercle cyan) pour **tous** les PNJ en jeu, quel que soit le PNJ | Un sprite par PNJ (voir tableau des PNJ ci-dessous — actuellement ils partagent tous ce même cercle, rien ne les distingue visuellement) |
| `NPC_PORTRAIT` | `generatePortraitTextures()` | Grande silhouette **générique** (moine encapuchonné, yeux cyan) affichée à droite pendant les dialogues, réutilisée pour **tous** les PNJ | Un portrait par PNJ, comme pour le sprite en jeu |
| `ENEMY` | `generateMarkerTexture(TEX.ENEMY, 0x8a1f3a, 'spike')` | Marqueur **générique** (silhouette hérissée rouge sombre) pour **tous** les mobs ET tous les boss (ces derniers juste plus grands, cf. `entities/Enemy.ts`) | Un sprite par mob/boss (cf. section Mobs & Boss ci-dessous pour le combat déjà fonctionnel derrière) |
| `BOSS_ARENA` | `generateMarkerTexture(TEX.BOSS_ARENA, 0xd63b3b, 'diamond')` | Marqueur affiché tant que le boss de la zone n'a pas encore été affronté ; disparaît au profit du vrai sprite `ENEMY` (agrandi) une fois le combat lancé | Décor d'arène si voulu — le marqueur losange reste un repère UI valable |
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

## Mobs (5 par zone, difficulté croissante)

`entities/Enemy.ts` : patrouille de part et d'autre de son point d'apparition,
dégâts de contact au joueur (1 vie, sauf Mode Admin), encaisse les dégâts de
l'attaque du joueur (`Player.getAttackHitbox()`/`attackDamage()`, touche
**X** par défaut, remappable). PV/vitesse croissent avec la zone (1-8) ET le
tier (1-5, cf. `mobHp`/`mobSpeed`) : `gen-zones.mjs` place ces 5 entités
`"type": "mob"` par zone à des fractions fixes de la largeur (`MOB_FRACS`),
tier 1→5 de gauche à droite pour une difficulté "crescendo" au sein même du
chapitre. Un dash (pouvoir Dash fantôme) tue un mob touché au lieu d'en subir
les dégâts ; la Forme ombre rend intangible aux deux (traverse sans dégâts).

## Boss (vrai combat : PV, pattern, dialogue, musique dédiée)

| `bossId` | Zone | Pouvoir accordé | Pattern (`Constants.BOSS_DEFS`) |
|---|---|---|---|
| `boss_gardien_de_pierre` | 1 | Griffes renforcées | `slow_slam` (lent) |
| `boss_maitre_aveugle` | 2 | Vision féline | `erratic_fast` (rapide, imprévisible) |
| `boss_ombre_jumelle` | 3 | Dash fantôme | `mirror` (copie la position du joueur avec ~1s de délai) |
| `boss_velkhar_ancien` | 4 | Forme ombre | `phases` (accélère sous 50% PV) |
| `boss_jardinier_corrompu` | 6 | — | `slow_slam` |
| `boss_double_de_lumiere` | 7 | — (nécessite le combo `lame_duale`) | `mirror` |
| `boss_malakar_final` | 8 | — (boss final) | `phases3` (accélère par paliers à 66%/33% PV) |

`GameScene.handleBossArena()` : à la première interaction, si un
`dialogTree` est défini pour ce boss (cf. `BOSS_DEFS`, tous les
`*_pre_fight` dans `dialogues.json`), le joue d'abord — le vrai combat
(`startBossFight()`) ne démarre qu'à la fermeture du dialogue
(`onDialogEnd()`). Le boss est un `Enemy` comme un mob, juste plus gros/fort
et doté d'un `pattern`. Sa défaite (`onEnemyDefeated` → `resolveBossVictory()`)
reprend exactement l'ancien flux (pouvoir accordé, célébration, sauvegarde).

**Musique par boss sans piste dédiée** : les 10 pistes existantes couvrent
déjà menu/8 zones/fin — aucune piste "boss" en réserve. `BOSS_DEFS.musicRate`
donne à chaque boss un régime (vitesse/hauteur) distinct appliqué à la
musique de zone déjà en cours via `audioManager.setMusicRate()` pendant le
combat, remise à 1 à la victoire. Une vraie piste dédiée par boss remplacerait
directement cet appel si vous en ajoutez.

## Autres fichiers utiles pour situer le contenu

- `message.txt` — brief de conception d'origine (zones, pouvoirs, boss, fins).
- `src/entities/Enemy.ts` — classe des mobs ET des boss (patrouille, PV,
  dégâts, patterns).
- `src/utils/Constants.ts` (`BOSS_DEFS`) — PV/vitesse/pattern/musique/dialogue
  par boss.
- `src/data/powers.json` — nom/icône/effet de chaque pouvoir (déjà réutilisé
  tel quel par les tutoriels de pouvoir, cf. `TutorialContent.ts`).
- `src/data/dialogues.json` — tous les arbres de dialogue, dont les
  `*_pre_fight` de chaque boss.
- `src/data/maps/zone*.json` — layout de chaque zone + entités (spawn, PNJ,
  boss, mobs, autels, sorties, puzzles).
- `scripts/gen-zones.mjs` — génère aussi les 5 mobs par zone (`MOB_FRACS`).
- `ACKNOWLEDGEMENTS.md` — provenance/licence de chaque asset déjà intégré.
