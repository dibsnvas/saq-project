import Phaser from "phaser";
import { eventBus } from "../EventBus";
import { audioManager } from "./AudioManager";
import {
  AUDIO_CROSSFADE_MS,
  AUDIO_FILES,
  AUDIO_STATES,
  type AudioOneShotSpec,
  type AudioStateId,
} from "./RoomAudioConfig";

/**
 * AmbientAudioSystem — звуковая машина состояний сценария поверх
 * AudioManager. Отвечает за:
 *  - переключение состояний (setState) с кроссфейдом слоёв;
 *  - редкие случайные one-shot'ы (реплики, кашель, двери) через
 *    scene.time — на паузе сцены планировщик автоматически замирает;
 *  - финальные последовательности успеха/таймаута (играются по часам
 *    AudioContext и не ломаются паузой сцены под дебрифом);
 *  - однократный неблокирующий тост, если браузер не дал звук.
 *
 * Экземпляр живёт вместе со SchoolScene; фактические лупы держит
 * синглтон AudioManager, поэтому restart сцены не плодит дубликатов.
 */
export class AmbientAudioSystem {
  private state: AudioStateId | null = null;
  private oneShotTimers: Phaser.Time.TimerEvent[] = [];
  private successPlayed = false;
  private finished = false;
  private blockedNotified = false;
  private readonly locale: string;

  constructor(private scene: Phaser.Scene) {
    this.locale =
      typeof document !== "undefined" &&
      document.documentElement.lang?.startsWith("ru")
        ? "ru"
        : "kk";
  }

  /** Текущее состояние (для отладки/условий сцены). */
  getState(): AudioStateId | null {
    return this.state;
  }

  /**
   * Переключает звуковую сцену. Идемпотентно: повторный вызов с тем же
   * состоянием ничего не перезапускает.
   */
  setState(state: AudioStateId, fadeMs = AUDIO_CROSSFADE_MS): void {
    if (this.state === state) return;
    // После финала (success/timeout) обратной дороги нет до restart.
    if (this.finished && state !== "success" && state !== "timeout") return;
    this.state = state;

    const config = AUDIO_STATES[state];
    audioManager.applyLoops(config.loops, fadeMs);
    this.rescheduleOneShots(config.oneShots ?? []);
  }

  /** Пробует активировать звук из пользовательского жеста. */
  ensureUnlocked(): void {
    void audioManager.unlock().then((running) => {
      if (running) {
        // Контекст появился после setState — доигрываем текущие слои.
        const state = this.state;
        if (state) {
          audioManager.applyLoops(AUDIO_STATES[state].loops, 400);
        }
        return;
      }
      if (audioManager.wasUnlockAttempted() && !this.blockedNotified) {
        this.blockedNotified = true;
        // Неблокирующий fallback: игра полностью проходима без звука.
        eventBus.emit("scenario:event", {
          id: "audio_unavailable",
          messageKey: "game.audioUnavailable",
          severity: "info",
        });
      }
    });
  }

  /** Фактор движения игрока — громкость слоёв шагов. */
  setMoving(moving: boolean): void {
    audioManager.setMovementFactor(moving ? 1 : 0);
  }

  /** Мягкий звук столкновения с плотной группой (без «болевых» ударов). */
  playCrowdBump(): void {
    void audioManager.playOneShot([AUDIO_FILES.crowdBump], "ui", 0.3);
  }

  /** Приглушение у дыма; при отходе amount → 0 быстро снимает эффект. */
  setSmokeMuffle(amount: number): void {
    audioManager.setAtmosphereMuffle(amount);
  }

  /** После доклада: сирена/tension постепенно уходят в спокойный двор. */
  beginOutdoorCalm(): void {
    if (this.finished) return;
    this.setState("outdoor", 1600);
    audioManager.setAtmosphereMuffle(0);
  }

  /** Открывание двери при переходе между комнатами. */
  playDoor(): void {
    void audioManager.playOneShot([AUDIO_FILES.doorOpen], "ui", 0.3);
  }

  /**
   * Реплика учителя при вмешательстве («Стойте! Этот путь опасен…»):
   * локализованная запись, при её отсутствии — приглушённый placeholder.
   */
  playTeacherCue(): void {
    void audioManager.playOneShot(
      [
        `/audio/voices/${this.locale}/teacher_stop.mp3`,
        AUDIO_FILES.teacherMuffled,
      ],
      "voice",
      0.55,
    );
  }

  /**
   * Успешное завершение: chime → короткая спокойная музыка, двор остаётся
   * фоном. Играется ровно один раз за прохождение.
   */
  playSuccessSequence(): void {
    if (this.successPlayed) return;
    this.successPlayed = true;
    this.finished = true;
    this.setState("success", 700);
    void audioManager.playOneShot([AUDIO_FILES.successChime], "music", 0.42);
    // Музыка после chime; по часам AudioContext — пауза сцены не мешает.
    void audioManager.playOneShot([AUDIO_FILES.successMusic], "music", 0.4, 1100);
  }

  /** Таймаут: нейтральный тихий сигнал, никакой победной музыки. */
  playTimeoutSequence(): void {
    if (this.finished) return;
    this.finished = true;
    this.setState("timeout", 700);
    void audioManager.playOneShot([AUDIO_FILES.lowCompletion], "ui", 0.34);
  }

  /** Пауза: сильный duck без остановки лупов (resume не создаёт дублей). */
  setPaused(paused: boolean): void {
    audioManager.setDucked(paused);
  }

  /** Полный сброс перед restart сцены: новая попытка стартует с чистого листа. */
  reset(): void {
    this.clearOneShots();
    this.successPlayed = false;
    this.finished = false;
    this.state = null;
    audioManager.stopOneShots();
    audioManager.setDucked(false);
    audioManager.setAtmosphereMuffle(0);
  }

  /** Остановка всего при выгрузке сцены/игры. */
  destroy(): void {
    this.clearOneShots();
    audioManager.setMovementFactor(0);
    audioManager.setDucked(false);
    audioManager.stopAll(200);
  }

  // ---------------------------------------------------------- one-shots

  private rescheduleOneShots(specs: AudioOneShotSpec[]): void {
    this.clearOneShots();
    for (const spec of specs) this.scheduleOneShot(spec);
  }

  private scheduleOneShot(spec: AudioOneShotSpec): void {
    const delay = Phaser.Math.Between(spec.minDelayMs, spec.maxDelayMs);
    const timer = this.scene.time.delayedCall(delay, () => {
      this.oneShotTimers = this.oneShotTimers.filter((t) => t !== timer);
      const urls =
        typeof spec.urls === "function" ? spec.urls(this.locale) : spec.urls;
      void audioManager.playOneShot(urls, spec.category, spec.volume);
      this.scheduleOneShot(spec); // следующий случайный интервал
    });
    this.oneShotTimers.push(timer);
  }

  private clearOneShots(): void {
    for (const timer of this.oneShotTimers) timer.remove(false);
    this.oneShotTimers = [];
  }
}
