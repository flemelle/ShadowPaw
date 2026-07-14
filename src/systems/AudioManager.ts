import Phaser from 'phaser';

const MUSIC_VOLUME = 0.5;
const SFX_VOLUME = 0.6;
const CROSSFADE_MS = 900;
const MUTE_KEY = 'shadowpaw_audio_muted';

/**
 * Musique (crossfade entre pistes) + SFX ponctuels. Le SoundManager de Phaser
 * est unique par instance de jeu (partagé entre toutes les scènes) ; seul le
 * tween de fondu a besoin d'une scène active, passée explicitement à chaque appel.
 */
export class AudioManager {
  private sound?: Phaser.Sound.BaseSoundManager;
  private currentMusic?: Phaser.Sound.BaseSound;
  private currentMusicKey?: string;
  private muted = localStorage.getItem(MUTE_KEY) === '1';

  attach(scene: Phaser.Scene): void {
    this.sound = scene.sound;
    this.sound.mute = this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    if (this.sound) this.sound.mute = muted;
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  playMusic(scene: Phaser.Scene, key: string): void {
    if (!this.sound) this.attach(scene);
    if (!this.sound || this.currentMusicKey === key) return;

    const previous = this.currentMusic;
    const next = this.sound.add(key, { loop: true, volume: 0 });
    next.play();
    this.currentMusic = next;
    this.currentMusicKey = key;

    scene.tweens.add({ targets: next, volume: MUSIC_VOLUME, duration: CROSSFADE_MS });
    if (previous) {
      scene.tweens.add({
        targets: previous,
        volume: 0,
        duration: CROSSFADE_MS,
        onComplete: () => previous.destroy(),
      });
    }
  }

  stopMusic(): void {
    this.currentMusic?.stop();
    this.currentMusic?.destroy();
    this.currentMusic = undefined;
    this.currentMusicKey = undefined;
  }

  play(scene: Phaser.Scene, key: string, config?: Phaser.Types.Sound.SoundConfig): void {
    if (!this.sound) this.attach(scene);
    this.sound?.play(key, { volume: SFX_VOLUME, ...config });
  }
}

export const audioManager = new AudioManager();
