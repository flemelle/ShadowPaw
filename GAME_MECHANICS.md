# Mécaniques du jeu — Shadowpaw

Référence rapide de toutes les mécaniques en place et des types de mobs/PNJ. Pour ce qui est
encore un visuel généré (à remplacer par du vrai art) plutôt qu'une mécanique, voir `HANDOFF.md`.

## Déplacement

- Gauche/droite, saut (avec coyote time + jump buffer), Espace saute toujours en plus de la
  touche remappable (`Player.ts`).
- **Dash fantôme** (pouvoir) : ruée rapide, invincibilité courte, traverse les grilles liées à ce
  pouvoir — et, en combat, tue instantanément tout mob/boss touché pendant le dash.
- **Forme ombre** (pouvoir) : intangibilité 5s, traverse la matière fine ET les ennemis sans
  subir ni infliger de dégâts.
- Mode Admin (`?admin=1` ou depuis le menu) : noclip (touche N), tous les pouvoirs, sélecteur de
  chapitre (F1), invulnérable au combat comme aux chutes.

## Pouvoirs (traversal + combat)

Chaque pouvoir d'Acte 1 est accordé par un boss ; Éclat de Lumière par la Source en fin d'Acte 1.

| Pouvoir | Effet traversal | Effet combat |
|---|---|---|
| Griffes renforcées | Casse les parois fissurées (`C`) | +1 dégât à l'attaque de griffes |
| Vision féline | Révèle passages cachés (`V`) et PNJ spectraux | — |
| Dash fantôme | Traverse les grilles (`D`) | Tue au contact pendant le dash |
| Forme ombre | Traverse la matière fine (`S`) | Intangible aux ennemis |
| Éclat de Lumière | Détruit les obstacles d'ombre (`L`) | +1 dégât à l'attaque de griffes |

## Combat

- **Attaque de base** (griffure, touche **X** par défaut) : dispo dès le début de la partie,
  courte portée devant Kiba, dégâts = 1 + 1 par pouvoir de dégâts débloqué (jusqu'à 3).
- **Mobs** : 5 par zone (8 zones), patrouillent, dégâts de contact (1 vie), PV croissants avec la
  zone et leur position dans la zone (tier 1-5, "crescendo" au sein du chapitre).
- **Boss** : un vrai combat (PV, pattern de déplacement propre à chacun, cf. table ci-dessous),
  précédé d'une courte tirade la première fois, victoire = pouvoir accordé + célébration.
- Vies : 3 cœurs, perdues à la chute, au contact d'un mob/boss (jamais en Mode Admin) ; à 0,
  écran de Game Over et retour au menu (la progression déjà acquise est conservée).

### Types de mobs

Un seul type visuel (silhouette générique, cf. `HANDOFF.md`), la difficulté vient des PV/vitesse :

| Zone | Tier 1 → 5 (PV) |
|---|---|
| 1 | 2 → 6 |
| 2 | 3 → 7 |
| ... | croît de +1 PV par zone, +1 PV par tier (cf. `mobHp` dans `entities/Enemy.ts`) |
| 8 | 9 → 13 |

### Boss (7, un par transition de zone sauf zone 5)

| Boss | Zone | Pattern |
|---|---|---|
| Le Gardien de Pierre | 1 | Lent, contact large ("attaques de zone") |
| Maître Aveugle | 2 | Rapide, change de direction sans prévenir |
| L'Ombre Jumelle | 3 | Copie la position du joueur avec ~1s de délai |
| Velkhar l'Ancien | 4 | Accélère sous 50% de PV (2 phases) |
| Le Jardinier Corrompu | 6 | Lent, contact large |
| Le Double de Lumière | 7 | Copie la position du joueur avec délai |
| Malakar, Sensei de l'Ombre | 8 (final) | Accélère par paliers à 66%/33% de PV (3 phases) |

## PNJ & dialogues

Système à arbre (`DialogSystem.ts` + `dialogues.json`) : nœuds de texte, choix, flags persistants
(déterminent notamment la fin A/B). Chaque PNJ n'affiche que son propre portrait/nom quand il
parle ; quand Kiba choisit une réplique, son propre portrait s'affiche le temps de cette ligne.

| PNJ | Zones | Rôle |
|---|---|---|
| Tozen, le Moine | 1, 2, 3 | Mentor récurrent, indices cryptiques |
| L'Esprit de Ryo | 3 | Visible uniquement avec Vision féline |
| Le Veilleur de Seikūji | 4 | Lore sur Hikari no Ne |
| L'Écho de Hikari | 5, 6 | Guide de l'Acte 2 |
| Un reflet | 7 | Annonce le boss de la zone |
| Malakar | 8 | Antagoniste, dialogue de choix de fin |

## Puzzles (Acte 2)

`PuzzleSystem.ts` + `PuzzleScene.ts` : déclenchés par des `puzzle_trigger`, résolution récoltant
les éclats de Hikari no Ne (`SHARD_COLLECT`), utilisés pour la fin et le niveau de "purification"
visuelle des zones corrompues.

## Progression & sauvegarde

`SaveSystem.ts` (localStorage) : zone courante, pouvoirs débloqués, boss vaincus, éclats
collectés, flags de dialogue, puzzles résolus. Le Game Over ne réinitialise **pas** cette
progression (seule la position repart du dernier point de sauvegarde naturel).
