/**
 * AudioManager — единственный владелец WebAudio-контекста игры.
 *
 * Принципы:
 *  - один AudioContext на сессию (синглтон через globalThis, переживает
 *    hot reload и перезапуски сцены — второй контекст не создаётся);
 *  - слои-лупы применяются декларативно (applyLoops = diff желаемого и
 *    текущего): повторный вызов с тем же набором ничего не дублирует;
 *  - граф: source → gain слоя → gain категории → duck → master → destination;
 *  - контекст создаётся/возобновляется только из пользовательского жеста
 *    (unlock()); до этого все вызовы безопасно копятся или игнорируются;
 *  - отсутствующий файл (404/битый) — не ошибка: слой просто пропускается,
 *    игра полностью проходима без звука.
 *
 * Модуль не импортирует ни Phaser, ни React — им пользуются обе стороны
 * (как eventBus). SSR-безопасен: window трогается только внутри методов.
 */

import {
  CATEGORY_BASE_VOLUME,
  PAUSE_DUCK_LEVEL,
  type AudioCategory,
  type AudioLoopSpec,
} from "./RoomAudioConfig";

const SOUND_STORAGE_KEY = "saq.soundEnabled";
const FADE_MIN_S = 0.03;

interface ActiveLoop {
  spec: AudioLoopSpec;
  source: AudioBufferSourceNode;
  gain: GainNode;
}

class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private duckGain: GainNode | null = null;
  private categoryGains = new Map<AudioCategory, GainNode>();

  /** кэш загрузок: null — файла нет, промис — загрузка идёт */
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private activeLoops = new Map<string, ActiveLoop>();
  /** играющие one-shot'ы — чтобы restart/unmount мог их оборвать */
  private activeOneShots = new Set<AudioBufferSourceNode>();
  /** поколение applyLoops: отсекает гонки асинхронной загрузки буферов */
  private loopGeneration = 0;

  private enabled = true;
  private enabledLoaded = false;
  private unlockAttempted = false;
  private movementFactor = 0;
  private ducked = false;
  /** 0..1 — приглушение у дыма (не пауза). */
  private atmosphereMuffle = 0;

  // ------------------------------------------------------- включение/выкл.

  isEnabled(): boolean {
    if (!this.enabledLoaded && typeof window !== "undefined") {
      this.enabledLoaded = true;
      try {
        this.enabled = window.localStorage.getItem(SOUND_STORAGE_KEY) !== "0";
      } catch {
        this.enabled = true;
      }
    }
    return this.enabled;
  }

  /** Включает/выключает весь игровой звук; выбор сохраняется в localStorage. */
  setEnabled(enabled: boolean): void {
    this.isEnabled(); // подгрузить сохранённое значение до перезаписи
    this.enabled = enabled;
    try {
      window.localStorage.setItem(SOUND_STORAGE_KEY, enabled ? "1" : "0");
    } catch {
      /* приватный режим — работаем без сохранения */
    }
    if (!this.ctx || !this.master) return;
    this.ramp(this.master.gain, enabled ? 1 : 0, 0.15);
  }

  // ------------------------------------------------------------- unlock

  /**
   * Создаёт/возобновляет контекст. Вызывать только из обработчика
   * пользовательского жеста (клик «Начать сценарий», выбор решения, toggle).
   */
  async unlock(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    this.unlockAttempted = true;
    try {
      if (!this.ctx) {
        const Ctor =
          window.AudioContext ??
          (window as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!Ctor) return false;
        this.ctx = new Ctor();
        this.buildGraph();
      }
      if (this.ctx.state === "suspended") {
        await this.ctx.resume();
      }
      return this.ctx.state === "running";
    } catch {
      return false;
    }
  }

  isUnlocked(): boolean {
    return this.ctx?.state === "running";
  }

  wasUnlockAttempted(): boolean {
    return this.unlockAttempted;
  }

  private buildGraph(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.master = ctx.createGain();
    this.master.gain.value = this.isEnabled() ? 1 : 0;
    this.master.connect(ctx.destination);

    this.duckGain = ctx.createGain();
    this.duckGain.gain.value = this.ducked ? PAUSE_DUCK_LEVEL : 1;
    this.duckGain.connect(this.master);

    for (const category of Object.keys(
      CATEGORY_BASE_VOLUME,
    ) as AudioCategory[]) {
      const gain = ctx.createGain();
      gain.gain.value = CATEGORY_BASE_VOLUME[category];
      gain.connect(this.duckGain);
      this.categoryGains.set(category, gain);
    }
  }

  // ------------------------------------------------------------- буферы

  /**
   * Загрузка и декодирование с кэшем. Возвращает null для отсутствующих
   * файлов — результат тоже кэшируется, повторных запросов не будет.
   */
  private loadBuffer(url: string): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(url);
    if (cached) return cached;

    const promise = (async (): Promise<AudioBuffer | null> => {
      const ctx = this.ctx;
      if (!ctx) return null;
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.arrayBuffer();
        return await ctx.decodeAudioData(data);
      } catch {
        return null;
      }
    })();

    this.buffers.set(url, promise);
    return promise;
  }

  /** Предзагрузка набора файлов (например, стартового состояния). */
  preload(urls: string[]): void {
    if (!this.ctx) return;
    for (const url of urls) void this.loadBuffer(url);
  }

  // ------------------------------------------------------------- лупы

  /**
   * Декларативно применяет набор лупов с кроссфейдом:
   * исчезнувшие слои затухают и останавливаются, новые нарастают с нуля,
   * у оставшихся плавно обновляется громкость. Ключ слоя — url, поэтому
   * дубликат лупа невозможен по построению.
   */
  applyLoops(specs: AudioLoopSpec[], fadeMs: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const generation = ++this.loopGeneration;
    const fadeS = Math.max(FADE_MIN_S, fadeMs / 1000);
    const desired = new Map(specs.map((s) => [s.url, s]));

    // Убираем лишние
    for (const [url, loop] of this.activeLoops) {
      if (desired.has(url)) continue;
      this.activeLoops.delete(url);
      this.ramp(loop.gain.gain, 0, fadeS);
      const source = loop.source;
      window.setTimeout(() => {
        try {
          source.stop();
        } catch {
          /* уже остановлен */
        }
        source.disconnect();
        loop.gain.disconnect();
      }, fadeMs + 80);
    }

    // Обновляем/добавляем нужные
    for (const spec of specs) {
      const active = this.activeLoops.get(spec.url);
      if (active) {
        active.spec = spec;
        this.ramp(active.gain.gain, this.loopTarget(spec), fadeS);
        continue;
      }
      void this.startLoop(spec, generation, fadeS);
    }
  }

  private async startLoop(
    spec: AudioLoopSpec,
    generation: number,
    fadeS: number,
  ): Promise<void> {
    const buffer = await this.loadBuffer(spec.url);
    const ctx = this.ctx;
    if (!buffer || !ctx) return;
    // Пока грузились, состояние сменилось или слой уже стартовал — выходим.
    if (generation !== this.loopGeneration) return;
    if (this.activeLoops.has(spec.url)) return;

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.categoryGain(spec.category));

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    source.start();

    this.activeLoops.set(spec.url, { spec, source, gain });
    this.ramp(gain.gain, this.loopTarget(spec), fadeS);
  }

  private loopTarget(spec: AudioLoopSpec): number {
    return spec.movement ? spec.volume * this.movementFactor : spec.volume;
  }

  /** Фактор движения игрока (0..1) — управляет громкостью слоёв шагов. */
  setMovementFactor(factor: number): void {
    const clamped = Math.max(0, Math.min(1, factor));
    if (Math.abs(clamped - this.movementFactor) < 0.01) return;
    this.movementFactor = clamped;
    for (const loop of this.activeLoops.values()) {
      if (!loop.spec.movement) continue;
      this.ramp(loop.gain.gain, this.loopTarget(loop.spec), 0.12);
    }
  }

  // ------------------------------------------------------------- one-shot

  /**
   * Разовый звук. urls — кандидаты по приоритету (локализованная запись →
   * placeholder); играет первый существующий.
   */
  async playOneShot(
    urls: string[],
    category: AudioCategory,
    volume: number,
    delayMs = 0,
  ): Promise<void> {
    const ctx = this.ctx;
    if (!ctx || !this.isEnabled()) return;
    for (const url of urls) {
      const buffer = await this.loadBuffer(url);
      if (!buffer) continue;
      if (!this.ctx) return;
      const gain = ctx.createGain();
      gain.gain.value = volume;
      gain.connect(this.categoryGain(category));
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gain);
      // Планирование по часам контекста: не зависит от пауз Phaser-сцены.
      source.start(ctx.currentTime + delayMs / 1000);
      this.activeOneShots.add(source);
      source.onended = () => {
        this.activeOneShots.delete(source);
        source.disconnect();
        gain.disconnect();
      };
      return;
    }
  }

  // ------------------------------------------------------------- пауза

  /** Сильно приглушает всё на паузе; лупы не останавливаются — дублей нет. */
  setDucked(ducked: boolean): void {
    this.ducked = ducked;
    this.applyDuckGain(0.25);
  }

  /**
   * Лёгкое «затхле» приглушение у дыма (0..1). Быстро спадает при отходе.
   * Не путать с паузой: duck паузы важнее.
   */
  setAtmosphereMuffle(amount: number): void {
    const next = Math.max(0, Math.min(1, amount));
    if (Math.abs(next - this.atmosphereMuffle) < 0.03) return;
    this.atmosphereMuffle = next;
    this.applyDuckGain(0.18);
  }

  private applyDuckGain(fadeS: number): void {
    if (!this.duckGain) return;
    if (this.ducked) {
      this.ramp(this.duckGain.gain, PAUSE_DUCK_LEVEL, fadeS);
      return;
    }
    // Мягкий muffle: до ~0.62 при полном linger у дыма.
    const level = 1 - this.atmosphereMuffle * 0.38;
    this.ramp(this.duckGain.gain, level, fadeS);
  }

  // ------------------------------------------------------------- очистка

  /** Обрывает играющие/запланированные one-shot'ы (музыка успеха и т.п.). */
  stopOneShots(): void {
    for (const source of this.activeOneShots) {
      try {
        source.stop();
      } catch {
        /* ещё не стартовал или уже завершён */
      }
    }
    this.activeOneShots.clear();
  }

  /** Останавливает все лупы и one-shot'ы. Контекст переиспользуется. */
  stopAll(fadeMs = 250): void {
    this.applyLoops([], fadeMs);
    this.stopOneShots();
  }

  private categoryGain(category: AudioCategory): GainNode {
    const gain = this.categoryGains.get(category);
    if (gain) return gain;
    // Недостижимо при корректной конфигурации; страховка от рассинхрона.
    const fallback = this.ctx!.createGain();
    fallback.connect(this.duckGain ?? this.ctx!.destination);
    this.categoryGains.set(category, fallback);
    return fallback;
  }

  private ramp(param: AudioParam, target: number, seconds: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(target, now + Math.max(FADE_MIN_S, seconds));
  }
}

/** Синглтон, устойчивый к hot reload — второй AudioContext не появляется. */
const globalRef = globalThis as { __saqAudioManager?: AudioManager };

export const audioManager: AudioManager =
  globalRef.__saqAudioManager ?? (globalRef.__saqAudioManager = new AudioManager());
