import type {
  TelemetryEvent,
  TelemetryRepository,
} from "./TelemetryRepository";

/**
 * Собирает события прохождения в памяти и передаёт итоговую запись
 * в репозиторий при завершении сценария.
 *
 * Источник игрового времени задаётся снаружи (setClock) — обычно это
 * ScenarioEngine.elapsedMs, который не тикает на паузе.
 */
export class TelemetrySystem {
  private events: TelemetryEvent[] = [];
  private finished = false;
  private clock: () => number = () => 0;

  constructor(
    private scenarioId: string,
    private repository: TelemetryRepository,
  ) {}

  setClock(clock: () => number): void {
    this.clock = clock;
  }

  start(): void {
    this.events = [];
    this.finished = false;
  }

  /** Read-only снимок событий (для ScenarioEvaluator). */
  getEvents(): ReadonlyArray<TelemetryEvent> {
    return this.events;
  }

  record(
    id: string,
    x: number,
    y: number,
    meta?: TelemetryEvent["meta"],
  ): void {
    if (this.finished) return;
    this.events.push({
      id,
      t: Math.round(this.clock()),
      x: Math.round(x),
      y: Math.round(y),
      ...(meta ? { meta } : {}),
    });
  }

  complete(durationMs: number): void {
    if (this.finished) return;
    this.finished = true;
    this.repository.save({
      scenarioId: this.scenarioId,
      completed: true,
      durationMs: Math.round(durationMs),
      recordedAt: new Date().toISOString(),
      events: this.events,
    });
  }
}
