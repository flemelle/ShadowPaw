import { keyBindings } from '@/systems/KeyBindings';
import { powerSystem } from '@/systems/GameState';
import type { PowerId } from '@/utils/Constants';
import type { ControlAction } from '@/systems/KeyBindings';

export interface TutorialStep {
  icon: string;
  title: string;
  lines: string[];
}

/** Tutoriel d'introduction, affiché une seule fois au tout début d'une nouvelle partie. */
export function buildIntroTutorialSteps(): TutorialStep[] {
  return [
    {
      icon: '🐾',
      title: 'Bienvenue, Kiba',
      lines: [
        'Les ombres du Clan rôdent dans le Domaine de Velkhar.',
        `${keyBindings.getKeyName('left')} / ${keyBindings.getKeyName('right')} : se déplacer.`,
      ],
    },
    {
      icon: '⬆',
      title: 'Sauter',
      lines: [
        `${keyBindings.getKeyName('jump')} ou Espace : sauter.`,
        'Un bref temps de grâce laisse encore sauter juste après avoir quitté une plateforme.',
      ],
    },
    {
      icon: '💬',
      title: 'Interagir',
      lines: [
        `${keyBindings.getKeyName('interact')} : parler à un PNJ, activer un autel de pouvoir ou affronter un gardien.`,
      ],
    },
    {
      icon: '⏸',
      title: 'Pause',
      lines: [`${keyBindings.getKeyName('pause')} : mettre en pause, remapper les touches ou quitter vers le menu.`],
    },
  ];
}

/** Tutoriel de combat, affiché une seule fois à la première approche d'un ennemi. */
export function buildCombatTutorialSteps(): TutorialStep[] {
  return [
    {
      icon: '⚔',
      title: 'Une ombre approche',
      lines: [
        `${keyBindings.getKeyName('attack')} : donner un coup de griffe.`,
        'Le contact avec un ennemi coûte une vie — attaque en premier ou reste à distance.',
      ],
    },
  ];
}

/** Tutoriel affiché une seule fois à l'entrée du combat contre Malakar (pattern 'phases3',
 * cf. Enemy.updateBossCombatAI) — ses trois attaques (ruée, orbe, onde de choc) sont nouvelles,
 * d'où le rappel explicite de la touche d'attaque du joueur pour riposter pendant sa récupération. */
export function buildBossTutorialSteps(): TutorialStep[] {
  return [
    {
      icon: '👻',
      title: 'Malakar, Sensei de l\'Ombre',
      lines: [
        'Trois attaques à surveiller : une ruée fulgurante, une orbe d\'ombre à distance, une onde de choc au sol.',
        'Chaque attaque est précédée d\'un bref avant-coup — esquive dès qu\'il apparaît.',
        `${keyBindings.getKeyName('attack')} : riposte d'un coup de griffe pendant sa récupération, juste après une attaque.`,
      ],
    },
  ];
}

/** Les pouvoirs "actifs" se déclenchent avec une touche ; les autres agissent au simple contact. */
const POWER_KEY_ACTION: Partial<Record<PowerId, ControlAction>> = {
  dash_fantome: 'dash',
  forme_ombre: 'shadowForm',
};

/** Mini tutoriel affiché juste après l'acquisition d'un nouveau pouvoir (une seule fois). */
export function buildPowerTutorialSteps(power: PowerId): TutorialStep[] {
  const def = powerSystem.getDef(power);
  if (!def) return [];

  const action = POWER_KEY_ACTION[power];
  const howTo = action
    ? `Appuie sur ${keyBindings.getKeyName(action)} pour l'utiliser.`
    : 'Agit automatiquement au contact des obstacles concernés — aucune touche à presser.';

  return [
    {
      icon: def.icon,
      title: `Nouveau pouvoir : ${def.name}`,
      lines: [def.effect, howTo, def.traversal.description],
    },
  ];
}
