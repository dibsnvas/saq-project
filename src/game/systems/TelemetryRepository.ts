/**
 * Хранилище телеметрии отделено интерфейсом: сегодня это localStorage,
 * завтра — API-репозиторий. Игровая сцена и TelemetrySystem об этом не знают.
 * Персональные данные (имя, email и т.п.) НЕ сохраняются.
 */

export interface TelemetryEvent {
  /** id игрового события, например smoke_detected */
  id: string;
  /** миллисекунды от старта сценария */
  t: number;
  /** позиция игрока в мировых координатах */
  x: number;
  y: number;
  meta?: Record<string, string | number | boolean>;
}

export interface TelemetryRunRecord {
  scenarioId: string;
  completed: boolean;
  durationMs: number;
  /** ISO-время записи — техническая метка, не привязана к личности */
  recordedAt: string;
  events: TelemetryEvent[];
}

export interface TelemetryRepository {
  save(record: TelemetryRunRecord): void;
}

const STORAGE_KEY = "saq.telemetry.runs";
const MAX_STORED_RUNS = 20;

export class LocalStorageTelemetryRepository implements TelemetryRepository {
  save(record: TelemetryRunRecord): void {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const runs: TelemetryRunRecord[] = raw ? JSON.parse(raw) : [];
      runs.push(record);
      // Не даём хранилищу расти бесконечно.
      const trimmed = runs.slice(-MAX_STORED_RUNS);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // Приватный режим или переполненное хранилище — телеметрия не должна
      // ломать прохождение.
    }
  }
}
