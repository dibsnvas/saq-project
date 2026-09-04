/**
 * Branching policy — единственное место, где живут пороги и правила
 * ветвления: источники информации о маршруте, политика вмешательства
 * учителя, распознавание исправленных ошибок и разрешение итога.
 *
 * Чистые данные и функции без Phaser/React: gameplay эмитит события,
 * evaluator считает по этим правилам, UI отображает готовый результат.
 * Одинаковая история событий всегда даёт одинаковый итог.
 */

export type ScenarioOutcome =
  | "safe_independent"
  | "safe_with_guidance"
  | "safe_with_risks"
  | "incomplete";

/** Допустимые источники информации о безопасном маршруте (central hall). */
export type RouteEvidence =
  | "evacuation_plan"
  | "teacher_instruction"
  | "safe_exit_sign";

/** Понятные уровни навыка для UI (без псевдоточности вида 87.43). */
export type SkillLevel = "strong" | "developing" | "needs_review";

export type CompanionOutcome =
  | "not_helped"
  | "helped_safely"
  | "help_attempt_risky"
  | "safe_at_assembly";

/**
 * Политика вмешательства учителя в central hall. Учитель — страховка,
 * а не постоянная стрелка-подсказка: реагирует только на устойчиво
 * опасное поведение и не повторяется каждую секунду.
 */
export const TEACHER_INTERVENTION = {
  /**
   * Игрок остаётся у задымлённого выхода после предупреждения route_blocked
   * (danger-зона lingerMs = 2500): ещё столько мс — и учитель останавливает.
   */
  lingerBeyondWarningMs: 2200,
  /** Повторный вход в danger-зону после предупреждения → вмешательство. */
  reapproachAfterWarning: true,
  /**
   * После medium-дыма игрок долго не выбирает маршрут и не имеет ни одного
   * источника информации — учитель подсказывает направление.
   */
  indecisionAfterMediumMs: 16000,
  /** Реплика учителя не повторяется чаще, чем раз в столько мс. */
  cooldownMs: 9000,
} as const;

/** Распознавание исправленных ошибок. */
export const CORRECTION_POLICY = {
  /**
   * Подход к дыму считается осмысленным (и его отмена — исправлением),
   * только если игрок пробыл в danger-зоне не меньше этого времени.
   * Случайное касание зоны исправлением/риском не считается.
   */
  smokeApproachMinMs: 1100,
} as const;

/**
 * Пары «риск → исправление». Исправленная ошибка остаётся в истории,
 * но весит меньше продолжительного опасного поведения (см. скоринг).
 * fixEvent может приходить и без riskEvent — тогда это просто
 * своевременное безопасное решение.
 */
export const CORRECTIONS: Array<{
  id: string;
  /** риск, который исправляется (если встретился) */
  riskEvent: string | null;
  /** событие-исправление ИЛИ пара [риск, более позднее исправление] */
  fixEvent: string;
  messageKey: string;
}> = [
  {
    id: "smoke_retreat",
    riskEvent: "route_blocked",
    fixEvent: "smoke_approach_corrected",
    messageKey: "debrief.correction.smokeRetreat",
  },
  {
    id: "crowd_checked",
    riskEvent: "followed_crowd_without_checking",
    fixEvent: "crowd_following_corrected",
    messageKey: "debrief.correction.crowdChecked",
  },
  {
    id: "calm_lane_switch",
    riskEvent: "pushed_through_crowd",
    fixEvent: "stairs_pushing_corrected",
    messageKey: "debrief.correction.calmLaneSwitch",
  },
  {
    // Выбежал не оценив, но остановился и оценил обстановку в коридоре.
    id: "rush_assessed",
    riskEvent: "rushed_without_assessing",
    fixEvent: "assessed_corridor",
    messageKey: "debrief.correction.rushAssessed",
  },
];

/**
 * Скоринг измерений. Числа внутренние; наружу выходят только уровни.
 * Веса согласованы с rules.json: сильные самостоятельные источники
 * (план/знак) стоят больше, чем следование инструкции; зависимость от
 * вмешательства учителя и «шёл только за толпой» — главные минусы awareness.
 */
export const AWARENESS_WEIGHTS: Record<string, number> = {
  evacuation_plan_checked: 2,
  safe_exit_sign_detected: 2,
  teacher_instruction_followed: 1,
  assessed_environment: 1,
  assessed_corridor: 1,
  smoke_noticed_from_distance: 1,
  changed_route_after_smoke: 1,
  followed_crowd_without_checking: -1,
  crowd_following_route: -2,
  teacher_intervened: -2,
};

export const SAFETY_WEIGHTS: Record<string, number> = {
  followed_teacher_instruction: 1,
  assessed_environment: 1,
  took_calm_lane: 1,
  stairs_flow_used: 1,
  student_referred_to_teacher: 1,
  companion_safe: 1,
  /** ушёл от задымлённого пути на безопасный — главное защитное действие */
  changed_route_after_smoke: 1,
  returned_for_belongings: -1,
  backpack_note: -1,
  rushed_without_assessing: -1,
  /**
   * -3: длительное стояние в дыму — самый тяжёлый риск; даже исправленное
   * отступление (refund +1) не возвращает прохождению статус образцового.
   */
  route_blocked: -3,
  pushed_through_crowd: -1,
  attempted_reentry: -2,
};

/** Исправление возвращает часть потерянного веса риска (но не весь). */
export const CORRECTION_REFUND: Record<string, number> = {
  route_blocked: 1, // smoke_approach_corrected
  pushed_through_crowd: 1, // stairs_pushing_corrected
  rushed_without_assessing: 1, // assessed_corridor
  followed_crowd_without_checking: 1, // crowd_following_corrected
};

/** Какое исправление «гасит» какой риск (для refund и criticalRisks). */
export const RISK_FIX: Record<string, string> = {
  route_blocked: "smoke_approach_corrected",
  pushed_through_crowd: "stairs_pushing_corrected",
  rushed_without_assessing: "assessed_corridor",
  followed_crowd_without_checking: "crowd_following_corrected",
};

/**
 * Риски, которые (неисправленными) закрывают путь к safe_independent.
 * attempted_reentry не имеет исправления — возврат в здание всегда критичен.
 */
export const CRITICAL_RISKS = [
  "route_blocked",
  "pushed_through_crowd",
  "rushed_without_assessing",
  "followed_crowd_without_checking",
  "returned_for_belongings",
  "backpack_note",
  "attempted_reentry",
] as const;

/**
 * Пороги итога.
 * INDEPENDENT_AWARENESS = 3: минимум один сильный источник (план/знак = 2)
 * плюс любое подтверждение осознанности, либо несколько слабых — «понял сам».
 * GUIDANCE_AWARENESS = 3: после вмешательства учителя игрок считается
 * ведомым, если сам не набрал самостоятельных подтверждений.
 * SAFE_SAFETY = 1: хотя бы одно устойчиво безопасное действие при нуле
 * некритичных потерь — иначе прохождение «на грани» не считается образцовым.
 */
export const OUTCOME_THRESHOLDS = {
  INDEPENDENT_AWARENESS: 3,
  GUIDANCE_AWARENESS: 3,
  SAFE_SAFETY: 1,
} as const;

/** Границы уровней (score → SkillLevel). */
export const LEVEL_BANDS = {
  awareness: { strong: 3, developing: 1 },
  safety: { strong: 2, developing: 0 },
} as const;

export function toLevel(
  score: number,
  bands: { strong: number; developing: number },
): SkillLevel {
  if (score >= bands.strong) return "strong";
  if (score >= bands.developing) return "developing";
  return "needs_review";
}

/** Суммирует веса по фактически случившимся событиям + refund исправлений. */
export function scoreDimension(
  seen: ReadonlySet<string>,
  weights: Record<string, number>,
  withCorrectionRefund: boolean,
): number {
  let score = 0;
  for (const [event, weight] of Object.entries(weights)) {
    if (!seen.has(event)) continue;
    score += weight;
    if (
      withCorrectionRefund &&
      weight < 0 &&
      RISK_FIX[event] &&
      seen.has(RISK_FIX[event])
    ) {
      score += CORRECTION_REFUND[event] ?? 0;
    }
  }
  return score;
}

/** Неисправленные критические риски. */
export function uncorrectedCriticalRisks(seen: ReadonlySet<string>): string[] {
  return CRITICAL_RISKS.filter((risk) => {
    if (!seen.has(risk)) return false;
    const fix = RISK_FIX[risk];
    return !(fix && seen.has(fix));
  });
}

/** Сработавшие исправления (для дебрифа). */
export function detectCorrections(seen: ReadonlySet<string>): string[] {
  return CORRECTIONS.filter((c) => {
    if (!seen.has(c.fixEvent)) return false;
    // rush_assessed — исправление только если риск действительно был.
    if (c.riskEvent && c.id === "rush_assessed") return seen.has(c.riskEvent);
    return true;
  }).map((c) => c.messageKey);
}

/**
 * Детерминированное разрешение итога. Порядок проверок фиксирован:
 * незавершённость → ведомость → самостоятельность → «с рисками».
 */
export function resolveOutcome(input: {
  success: boolean;
  seen: ReadonlySet<string>;
  teacherInterventions: number;
  awarenessScore: number;
  safetyScore: number;
}): ScenarioOutcome {
  // Обязательные критерии завершения: никакое количество мелких плюсов
  // не компенсирует отсутствие доклада или точки сбора.
  if (
    !input.success ||
    !input.seen.has("reported_to_teacher") ||
    !input.seen.has("reached_assembly")
  ) {
    return "incomplete";
  }

  if (input.teacherInterventions > 0) {
    // Маршрут стал понятен только после вмешательства → ведомое прохождение;
    // если самостоятельные источники всё же были — это «с рисками».
    return input.awarenessScore < OUTCOME_THRESHOLDS.GUIDANCE_AWARENESS
      ? "safe_with_guidance"
      : "safe_with_risks";
  }

  const critical = uncorrectedCriticalRisks(input.seen);
  if (
    critical.length === 0 &&
    input.awarenessScore >= OUTCOME_THRESHOLDS.INDEPENDENT_AWARENESS &&
    input.safetyScore >= OUTCOME_THRESHOLDS.SAFE_SAFETY
  ) {
    return "safe_independent";
  }

  return "safe_with_risks";
}

/** Companion: помощь ценна, если не подвергала риску; итог — точка сбора. */
export function resolveCompanionOutcome(input: {
  helped: boolean;
  safeAtAssembly: boolean;
  /** route_blocked случился ПОСЛЕ того, как девочка пошла с игроком */
  riskyWhileEscorting: boolean;
}): CompanionOutcome {
  if (!input.helped) return "not_helped";
  if (input.safeAtAssembly) return "safe_at_assembly";
  return input.riskyWhileEscorting ? "help_attempt_risky" : "helped_safely";
}
