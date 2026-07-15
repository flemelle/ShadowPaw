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
