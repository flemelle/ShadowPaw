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

  /**
   * Précharge en arrière-plan les pistes pas encore en cache, une par une avec un
   * léger délai entre chaque — sans ça, la première visite d'une zone déclenche un
   * chargement + décodage audio synchrone au moment de la transition, ce qui se
   * ressent comme un micro-freeze. Silencieux, ne joue rien, n'interrompt rien.
   */
  prefetchMusic(scene: Phaser.Scene, keys: string[]): void {
    const remaining = keys.filter((k) => !scene.cache.audio.exists(k));
    if (remaining.length === 0) return;
    const [next, ...rest] = remaining;
    try {
      const path = MUSIC_PATHS[next];
      if (!path) {
        this.prefetchMusic(scene, rest);
        return;
      }
      scene.load.audio(next, path);
      scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
        scene.time.delayedCall(600, () => this.prefetchMusic(scene, rest));
      });
      if (!scene.load.isLoading()) scene.load.start();
    } catch (err) {
      console.warn(`[AudioManager] prefetchMusic("${next}") failed:`, err);
    }
  }

  /**
   * Ajuste la hauteur/vitesse de la piste en cours, sans la relancer ni la recharger — utilisé
   * pour donner à chaque combat de boss une identité audible propre (cf. Constants.BOSS_DEFS)
   * quand aucune piste dédiée par boss n'existe : la musique de zone déjà en cours change de
   * régime le temps du combat, puis `setMusicRate(1)` la restaure à la fin.
   */
  setMusicRate(rate: number): void {
    const sound = this.currentMusic as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound | undefined;
    sound?.setRate?.(rate);
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
