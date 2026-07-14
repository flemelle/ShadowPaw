import Phaser from 'phaser';
import { MUSIC_PATHS } from '@/utils/Constants';

const MUSIC_VOLUME = 0.5;
const SFX_VOLUME = 0.6;
const CROSSFADE_MS = 900;
const MUTE_KEY = 'shadowpaw_audio_muted';

/**
 * Musique (crossfade entre pistes, chargées à la demande — cf. Constants.MUSIC_PATHS)
 * + SFX ponctuels. Le SoundManager de Phaser est unique par instance de jeu
 * (partagé entre toutes les scènes) ; seul le tween de fondu a besoin d'une
 * scène active, passée explicitement à chaque appel.
 *
 * Toute erreur (son manquant, décodage échoué, contexte audio bloqué...) est
 * avalée ici plutôt que jetée : un SFX qui échoue ne doit jamais interrompre
 * l'action du bouton/interaction qui le déclenche.
 */
export class AudioManager {
  private sound?: Phaser.Sound.BaseSoundManager;
  private currentMusic?: Phaser.Sound.BaseSound;
  private currentMusicKey?: string;
  private loadingKey?: string;
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
    try {
      if (!this.sound) this.attach(scene);
      if (!this.sound || this.currentMusicKey === key || this.loadingKey === key) return;

      if (!scene.cache.audio.exists(key)) {
        const path = MUSIC_PATHS[key];
        if (!path) return;
        this.loadingKey = key;
        scene.load.audio(key, path);
        scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
          this.loadingKey = undefined;
          this.playMusic(scene, key);
        });
        scene.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, () => {
          this.loadingKey = undefined;
        });
        if (!scene.load.isLoading()) scene.load.start();
        return;
      }

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
    } catch (err) {
      console.warn(`[AudioManager] playMusic("${key}") failed:`, err);
    }
  }

  stopMusic(): void {
    try {
      this.currentMusic?.stop();
      this.currentMusic?.destroy();
    } catch {
      // ignore
    }
    this.currentMusic = undefined;
    this.currentMusicKey = undefined;
  }

  play(scene: Phaser.Scene, key: string, config?: Phaser.Types.Sound.SoundConfig): void {
    try {
      if (!this.sound) this.attach(scene);
      if (!this.sound || !scene.cache.audio.exists(key)) return;
      this.sound.play(key, { volume: SFX_VOLUME, ...config });
    } catch (err) {
      console.warn(`[AudioManager] play("${key}") failed:`, err);
    }
  }
}

export const audioManager = new AudioManager();
