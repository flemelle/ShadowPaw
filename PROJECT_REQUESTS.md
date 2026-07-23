# Journal des demandes — Shadowpaw

Liste chronologique de toutes les demandes faites au fil des sessions, pour garder une vue
d'ensemble du projet. Chaque ligne : la demande telle que formulée (résumée), et son état.

Légende : ✅ fait · 🔧 en cours · ⏳ pas encore démarré

## Assets & cohérence visuelle
- ✅ Utiliser les nouveaux assets ajoutés, backgrounds de meilleure qualité, cohérence entre décors
- ✅ Corriger le contraste plateformes/fond, agrandir/espacer les cœurs de vie, enlever le fond gris du HUD
- ✅ Empêcher les décors de dépasser des plateformes/du sol (overflow de textures)
- ✅ Teindre le sol/les plateformes avec la couleur majoritaire du fond peint de chaque zone
- ✅ Dézoomer la caméra de jeu en général
- ✅ Caméra : suivre le joueur verticalement, seulement au-delà de la moitié de l'écran ; sol ancré en bas d'écran
- ✅ Corriger le sautillement de caméra au saut (boucle de rétroaction sur le seuil de suivi)
- ✅ Corriger le décor de fond qui débordait par-dessus le sol (échelle non compensée par le zoom caméra)

## Niveaux & génération procédurale
- ✅ Rendre les niveaux moins linéaires : plateformes en hauteur, reliefs de sol, jamais de cul-de-sac
- ✅ Garantir qu'aucune plateforme n'est isolée au-delà d'un saut (vérifié par script de reachability)
- ✅ Plafonner la largeur des fosses à une distance de saut sûre (max 4 tuiles)
- ✅ Garantir une distance minimum de 2 tuiles entre plateforme et sol/marche précédente
- ✅ Placer les entités intelligemment pour qu'aucun niveau ne soit infaisable

## Contrôles & UI
- ✅ Le saut doit fonctionner dès le début du jeu (Espace en plus de la touche remappable)
- ✅ Avancer dans les dialogues avec une touche
- ✅ Dans les dialogues, n'afficher que le personnage qui parle réellement (pas les deux en permanence)
- ✅ Fenêtre de dialogue à taille fixe, scrollable si le texte dépasse
- ✅ Texte en jeu : contour au lieu d'un fond gris semi-transparent, pour le contraste

## Progression & pouvoirs
- ✅ Ne pas remettre à zéro les compétences/pouvoirs à chaque Game Over
- ✅ Animation + son à l'acquisition d'un pouvoir (personnage qui s'élève, halo, flash) ; ralentie à ~5s
- ✅ Bloquer le joueur pendant l'animation de pouvoir, lancer le mini-tuto une fois terminée
- ✅ Corriger le halo qui ne suivait pas le joueur pendant l'animation
- ✅ Corriger le joueur qui retombait au sol une frame pendant l'animation (gravité non désactivée)
- ⏳ **Langue de l'ombre** : alphabet indéchiffrable (caractères spéciaux, PNJ dédiés à partir d'un
  certain niveau cohérent avec le scénario), compétence de lecture cachée en hauteur dans le
  premier niveau concerné, niveau bloqué sans cette compétence (avec message d'explication au
  joueur), PNJ déjà rencontrés qui redeviennent lisibles une fois la compétence acquise, mention
  "Langue de l'Ombre (traduit)" affichée sur les dialogues traduits

## Histoire, PNJ & cinématique
- ✅ Plus de PNJ avec plus de dialogues, qui évoluent avec la progression (pas les mêmes d'un niveau à l'autre)
- ✅ Cinématique de prologue au premier lancement du jeu

## Combat (nouveau périmètre, anciennement hors scope pour l'équipe)
- ✅ Mobs : 5 par chapitre, difficulté crescendo (au sein d'une zone ET d'une zone à l'autre)
- ✅ Attaques du joueur, gagnées au fil de la progression, au moins une dès le début du jeu
- ✅ Un vrai combat de boss à chaque fin de zone (PV, pattern, dialogue avant combat)
- ✅ Musique spécifique par boss (pas de piste dédiée disponible : régime/hauteur distincts de la musique de zone)
- ⏳ **Créatures à sauver** : petites créatures capturées par des mobs, une par une à partir d'un
  certain niveau (pas dès le début), toujours la même espèce, remerciement + bribe de lore à leur
  libération, retrouvailles en famille à la toute fin du jeu
- ⏳ **Succès/achievements** : système de succès, dont un pour avoir sauvé tous les personnages sauvables

## Bugs corrigés en cours de route
- ✅ Dialogue de zone 2 qui pointait vers celui de la zone 1
- ✅ Fond du menu avec bandes de couleur visibles (mauvais set de background)
- ✅ Écran de Game Over qui pouvait rester bloqué indéfiniment (dérive du Clock Phaser)
- ✅ Zone Admin : impossible de relancer un chapitre après avoir quitté une partie (scène de
  dialogue/tutoriel/puzzle restée active par-dessus le menu)

## Documentation
- ✅ `HANDOFF.md` : comment lancer le jeu, ce qui est généré vs à remplacer, hors scope
- ✅ `HANDOFF.md` mis à jour maintenant que le combat n'est plus hors scope
- ✅ `GAME_MECHANICS.md` : mécaniques du jeu + types de mobs/PNJ/boss (à enrichir avec les créatures à sauver)
- ✅ Ce journal des demandes (`PROJECT_REQUESTS.md`)
