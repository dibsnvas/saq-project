import type { RouteEvidence } from "./branching";

/**
 * Переживающее комнаты состояние сценария (не геометрия).
 * CrowdSystem / SchoolScene читают его при смене комнаты; evaluator
 * получает снапшот при завершении. Restart пересоздаёт объект целиком —
 * ветки прошлого прохождения не наследуются.
 */
/** Выбор у растерянной ученицы в коридоре. */
export type StudentHelpChoice = "companion" | "referred" | "declined" | null;

export interface ScenarioState {
  /** id варианта первого решения (calm|backpack|rush|assess); null до выбора */
  firstDecision: string | null;
  helpedStudent: boolean;
  companionActive: boolean;
  companionReachedAssembly: boolean;
  /** Как игрок решил вопрос с ученицей (null — не взаимодействовал). */
  studentHelpChoice: StudentHelpChoice;
  /** «выбежал не оценив» — одноразовая заминка на входе в коридор */
  rushNoticePending: boolean;
  reachedAssembly: boolean;

  /** Источники, по которым игрок понял безопасный маршрут (без дублей). */
  routeEvidence: RouteEvidence[];
  /** Сколько раз учителю пришлось останавливать игрока. */
  teacherInterventions: number;
  /** Игрок прошёл коридор, не оценив обстановку (для corrections). */
  followedCrowdCorridor: boolean;
  /** Проталкивался через плотную группу на лестнице. */
  pushedCrowd: boolean;
  /** Выбрал свободный проход на лестнице. */
  tookCalmLane: boolean;
}

export function createScenarioState(): ScenarioState {
  return {
    firstDecision: null,
    helpedStudent: false,
    companionActive: false,
    companionReachedAssembly: false,
    studentHelpChoice: null,
    rushNoticePending: false,
    reachedAssembly: false,
    routeEvidence: [],
    teacherInterventions: 0,
    followedCrowdCorridor: false,
    pushedCrowd: false,
    tookCalmLane: false,
  };
}

/** Добавляет источник маршрута без дублирования. */
export function addRouteEvidence(
  state: ScenarioState,
  evidence: RouteEvidence,
): void {
  if (!state.routeEvidence.includes(evidence)) {
    state.routeEvidence.push(evidence);
  }
}
