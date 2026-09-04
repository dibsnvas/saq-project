/**
 * Типизированный Event Bus — единственный канал связи между React (HUD,
 * мобильные контролы) и Phaser (сцены, системы). Ни одна из сторон не
 * импортирует состояние другой напрямую.
 *
 * ВАЖНО: модуль намеренно не импортирует Phaser — его подключает React-код,
 * который проходит SSR-проход, где Phaser падает на обращении к window.
 */

import type { DebriefReport } from "./scenario/evaluator";

export type ScenarioEventSeverity = "info" | "warning" | "danger";

export interface GameEventMap {
  "game:ready": { sceneKey: string };
  "objective:changed": { objectiveKey: string };
  "timer:changed": { remainingMs: number; totalMs: number };
  "interaction:available": { id: string; labelKey: string };
  "interaction:cleared": undefined;
  "scenario:event": {
    id: string;
    messageKey?: string;
    severity: ScenarioEventSeverity;
  };
  /** Игрок выбрал вариант первого решения (React → Phaser) */
  "decision:choose": { optionId: string };
  /** Короткий in-world выбор (ученица / учитель) */
  "choice:offer": {
    id: string;
    promptKey: string;
    options: Array<{ id: string; labelKey: string }>;
  };
  "choice:resolve": { id: string; optionId: string };
  /** Таймер сценария запущен (после первого решения) */
  "scenario:started": undefined;
  /**
   * Короткий финальный момент после доклада учителю — до DebriefPanel.
   * React показывает локализованный текст; Phaser крутит NPC/audio beat.
   */
  "scenario:completion_beat": {
    messageKey: string;
  };
  "scenario:completed": {
    timeMs: number;
    eventIds: string[];
    /** false — время вышло / сценарий провален */
    success: boolean;
    /** образовательный разбор для Debrief-панели */
    report: DebriefReport;
  };
  "game:pause": undefined;
  "game:resume": undefined;
  "game:restart": undefined;
  /** Пользователь переключил звук (React → Phaser, для телеметрии) */
  "audio:toggled": { enabled: boolean };
  /** Вектор виртуального джойстика, нормализован в [-1, 1] */
  "input:move": { x: number; y: number };
  "input:interact": undefined;
  /** Игрок сменил комнату (для мини-карты и HUD) */
  "room:changed": { room: string };
  /** Нормализованная позиция игрока внутри комнаты для мини-карты */
  "minimap:update": { room: string; x: number; y: number };
}

type EventKey = keyof GameEventMap;
type Handler<K extends EventKey> = (payload: GameEventMap[K]) => void;
type UnknownHandler = (payload: unknown) => void;

type EmitArgs<K extends EventKey> = GameEventMap[K] extends undefined
  ? [payload?: undefined]
  : [payload: GameEventMap[K]];

/** События, которые нельзя потерять, если listener ещё не подписан. */
const STICKY_ONCE = new Set<EventKey>(["decision:choose"]);

class TypedEventBus {
  private listeners = new Map<EventKey, Set<UnknownHandler>>();
  /** Sticky payload: отдаётся первому on() и сразу очищается. */
  private stickyOnce = new Map<EventKey, unknown>();

  on<K extends EventKey>(event: K, handler: Handler<K>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler as UnknownHandler);

    if (STICKY_ONCE.has(event) && this.stickyOnce.has(event)) {
      const payload = this.stickyOnce.get(event);
      this.stickyOnce.delete(event);
      handler(payload as GameEventMap[K]);
    }

    return () => this.off(event, handler);
  }

  off<K extends EventKey>(event: K, handler: Handler<K>): void {
    this.listeners.get(event)?.delete(handler as UnknownHandler);
  }

  emit<K extends EventKey>(event: K, ...args: EmitArgs<K>): void {
    if (event === "game:restart") {
      this.stickyOnce.delete("decision:choose");
    }

    const set = this.listeners.get(event);
    if (set && set.size > 0) {
      for (const handler of [...set]) {
        handler(args[0]);
      }
      return;
    }

    if (STICKY_ONCE.has(event)) {
      this.stickyOnce.set(event, args[0]);
    }
  }

  /** Тесты / явный сброс sticky decision. */
  clearSticky(event: EventKey): void {
    this.stickyOnce.delete(event);
  }

  /** Только для тестов. */
  hasSticky(event: EventKey): boolean {
    return this.stickyOnce.has(event);
  }

  /** Только для тестов: сброс listeners + sticky. */
  resetForTests(): void {
    this.listeners.clear();
    this.stickyOnce.clear();
  }
}

/**
 * Синглтон, устойчивый к hot reload: при повторной инициализации модуля в dev
 * переиспользуем существующую шину, чтобы Phaser и React не разъехались.
 */
const globalRef = globalThis as { __saqEventBus?: TypedEventBus };

export const eventBus: TypedEventBus =
  globalRef.__saqEventBus ?? (globalRef.__saqEventBus = new TypedEventBus());
