import Phaser from "phaser";
import { eventBus } from "../EventBus";
import type { ScenarioDefinition, TriggerZone } from "../scenario/schema";
import type { ScenarioState } from "../scenario/state";
import {
  evaluateScenario,
  type DebriefReport,
  type EvaluationPolicy,
} from "../scenario/evaluator";
import type { TelemetrySystem } from "./TelemetrySystem";

/** Локальные события сцены (Phaser-side), чтобы сцена реагировала визуально. */
export const SCENARIO_LOCAL_EVENT = "saq:scenario-event";
export const SCENARIO_LOCAL_COMPLETED = "saq:scenario-completed";
/** Успешный триггер пойман — сцена крутит короткий beat, затем finishPendingCompletion. */
export const SCENARIO_LOCAL_COMPLETION_PENDING =
  "saq:scenario-completion-pending";

export interface ScenarioCompletedLocalPayload {
  timeMs: number;
  exitId: string;
  success: boolean;
  report: DebriefReport;
}

/**
 * Data-driven движок сценария: читает trigger-зоны и события из
 * ScenarioDefinition (scenario.json, провалидированный Zod) и превращает
 * перемещения игрока в игровые события. Зоны привязаны к комнатам и
 * проверяются опросом позиции игрока — физика для этого не нужна.
 *
 * Часы сценария (elapsed) стоят до startClock(): интро-видео и первое
 * решение не тратят 180 секунд.
 */
export class ScenarioEngine {
  private triggered = new Set<string>();
  private completed = false;
  /** Доклад учителю принят — ждём outdoor beat перед evaluate/debrief. */
  private finishing = false;
  private pendingComplete: { exitId: string; success: boolean } | null = null;
  private elapsed = 0;
  private clockRunning = false;
  private eventLog: string[] = [];
  private activeRoom = "";
  /** зоны, внутри которых игрок находился в прошлом кадре (для once=false) */
  private inside = new Set<string>();

  constructor(
    private scene: Phaser.Scene,
    private scenario: ScenarioDefinition,
    private telemetry: TelemetrySystem,
    private state: ScenarioState,
    /** политика оценки здания; без неё — школьная */
    private policy?: EvaluationPolicy,
  ) {}

  /** Событие уже случалось в этом прохождении. */
  hasEvent(eventId: string): boolean {
    return this.eventLog.includes(eventId);
  }

  getState(): ScenarioState {
    return this.state;
  }

  start(): void {
    // Игровое время накапливаем по delta из UPDATE сцены: на паузе и в
    // дебрифе UPDATE не тикает, поэтому пауза не «съедает» таймер
    // (scene.time.now для этого не годится — он следует глобальным часам игры).
    this.elapsed = 0;
    this.clockRunning = false;
    const onUpdate = (_time: number, delta: number) => {
      if (this.clockRunning && !this.completed) this.elapsed += delta;
    };
    this.scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate);
    });

    eventBus.emit("objective:changed", {
      objectiveKey: this.scenario.objectiveKey,
    });
  }

  /** Запускает 180-секундные часы (после первого решения). */
  startClock(): void {
    if (this.clockRunning) return;
    this.clockRunning = true;
    eventBus.emit("scenario:started");
  }

  isClockRunning(): boolean {
    return this.clockRunning;
  }

  /** Штраф времени (например, возврат за рюкзаком). */
  addPenaltyMs(ms: number): void {
    this.elapsed += Math.max(0, ms);
  }

  setActiveRoom(roomId: string): void {
    this.activeRoom = roomId;
    this.inside.clear();
  }

  /** Опрос позиции игрока; вызывается из update() сцены. */
  update(playerX: number, playerY: number): void {
    if (this.completed || this.finishing) return;
    for (const zone of this.scenario.zones) {
      if (zone.room !== this.activeRoom) continue;
      const { rect } = zone;
      const contains =
        playerX >= rect.x &&
        playerX <= rect.x + rect.width &&
        playerY >= rect.y &&
        playerY <= rect.y + rect.height;

      if (contains && !this.inside.has(zone.id)) {
        this.inside.add(zone.id);
        this.onZoneEnter(zone);
      } else if (!contains) {
        this.inside.delete(zone.id);
      }
    }
  }

  /** Игровое время сценария; пауза сцены останавливает и его. */
  elapsedMs(): number {
    return this.elapsed;
  }

  isCompleted(): boolean {
    return this.completed;
  }

  /** Outdoor beat после доклада — зоны/таймер заморожены, debrief ещё нет. */
  isFinishing(): boolean {
    return this.finishing;
  }

  /** Завершает отложенный success-complete после outdoor beat. */
  finishPendingCompletion(): void {
    if (!this.pendingComplete || this.completed) return;
    const { exitId, success } = this.pendingComplete;
    this.pendingComplete = null;
    this.finishing = false;
    this.complete(exitId, success);
  }

  /** Позволяет сцене/интеракциям инициировать событие вручную. */
  dispatchEvent(eventId: string, position?: { x: number; y: number }): void {
    if (this.completed || this.finishing) return;
    const definition = this.scenario.events[eventId];
    this.eventLog.push(eventId);
    this.telemetry.record(eventId, position?.x ?? 0, position?.y ?? 0, {
      room: this.activeRoom,
    });
    eventBus.emit("scenario:event", {
      id: eventId,
      messageKey: definition?.messageKey,
      severity: definition?.severity ?? "info",
    });
    this.scene.events.emit(SCENARIO_LOCAL_EVENT, eventId);

    // Исчерпание таймера завершает сценарий как неуспех.
    if (eventId === "time_up") {
      this.complete("time_up", false);
      return;
    }
    // Доклад учителю: сначала короткий outdoor beat, затем debrief.
    if (this.scenario.completionTriggers.includes(eventId)) {
      if (eventId === "reported_to_teacher") {
        this.finishing = true;
        this.clockRunning = false;
        this.pendingComplete = { exitId: eventId, success: true };
        this.scene.events.emit(SCENARIO_LOCAL_COMPLETION_PENDING, {
          exitId: eventId,
        });
        return;
      }
      this.complete(eventId, true);
    }
  }

  private onZoneEnter(zone: TriggerZone): void {
    if (zone.once && this.triggered.has(zone.id)) return;
    this.triggered.add(zone.id);

    if (zone.event) {
      this.dispatchEvent(zone.event, {
        x: zone.rect.x + zone.rect.width / 2,
        y: zone.rect.y + zone.rect.height / 2,
      });
    }
    if (zone.id === "assembly_point") {
      this.state.reachedAssembly = true;
      if (this.state.companionActive && !this.state.companionReachedAssembly) {
        this.state.companionReachedAssembly = true;
        this.state.companionActive = false;
        this.dispatchEvent("companion_safe", {
          x: zone.rect.x + zone.rect.width / 2,
          y: zone.rect.y + zone.rect.height / 2,
        });
      }
    }

    if (this.scenario.completionTriggers.includes(zone.id)) {
      this.complete(zone.id, true);
    }
  }

  private complete(exitId: string, success: boolean): void {
    if (this.completed) return;
    this.completed = true;
    const timeMs = this.elapsed;

    this.telemetry.record("scenario_completed", 0, 0, {
      exit: exitId,
      room: this.activeRoom,
      success,
    });

    const report = evaluateScenario({
      events: this.telemetry.getEvents().map((e) => ({ id: e.id, t: e.t })),
      success,
      timeMs,
      firstDecision: this.state.firstDecision,
      companionHelped: this.state.helpedStudent,
      companionSafe: this.state.companionReachedAssembly,
      teacherInterventions: this.state.teacherInterventions,
      policy: this.policy,
    });

    this.telemetry.complete(timeMs);

    eventBus.emit("scenario:completed", {
      timeMs,
      eventIds: [...this.eventLog, "scenario_completed"],
      success,
      report,
    });
    this.scene.events.emit(SCENARIO_LOCAL_COMPLETED, {
      timeMs,
      exitId,
      success,
      report,
    } satisfies ScenarioCompletedLocalPayload);
  }
}
