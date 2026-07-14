import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, MUSIC_KEYS, SFX_KEYS, ZONE_MUSIC } from '@/utils/Constants';
import type { EndingCondition } from '@/systems/DialogSystem';
import { ParallaxBackground } from '@/systems/ParallaxBackground';
import { audioManager } from '@/systems/AudioManager';

interface EndSceneData {
  ending: EndingCondition & { id: string };
}

/** Écran de fin — Fin A (L'Équilibre Retrouvé) ou Fin B (L'Ombre Parfaite). */
export class EndScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.END);
  }

  create(data: EndSceneData): void {
    const isEndingA = data.ending.id === 'ending_a_equilibre';
    this.cameras.main.setBackgroundColor(isEndingA ? 0x120e1a : 0x05040a);

    new ParallaxBackground(this, isEndingA ? 'STRINGSTAR' : 'FOREST', GAME_WIDTH, false);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, isEndingA ? 0.35 : 0.55).setDepth(-1);

    audioManager.playMusic(this, isEndingA ? MUSIC_KEYS.ENDING_A : ZONE_MUSIC.zone5_seikuji_corrompu);
    this.time.delayedCall(400, () => {
      audioManager.play(this, isEndingA ? SFX_KEYS.ENDING_POSITIVE : SFX_KEYS.ENDING_NEGATIVE, { volume: 0.5 });
    });

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 100, data.ending.title, {
        fontFamily: 'Georgia, serif',
        fontSize: '44px',
        color: isEndingA ? '#ffe27a' : '#c9c2d9',
      })
      .setOrigin(0.5)
      .setShadow(0, 0, isEndingA ? '#d8b34a' : '#5a2e8a', 24, true, true);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, data.ending.summary, {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#e8e2f0',
        wordWrap: { width: GAME_WIDTH - 400 },
        align: 'center',
        lineSpacing: 8,
      })
      .setOrigin(0.5);

    const btn = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 100, 'Retour au menu', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#e8e2f0',
        backgroundColor: '#1a1428',
        padding: { x: 16, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => audioManager.play(this, SFX_KEYS.UI_HOVER, { volume: 0.25 }));
    btn.on('pointerdown', () => {
      audioManager.play(this, SFX_KEYS.UI_CONFIRM);
      this.scene.start(SCENE_KEYS.MENU);
    });
  }
}
