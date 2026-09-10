import rulesRaw from "@/content/fire-school/rules.json";
import { parseRules, type EducationalRule } from "./schema";
import {
  detectCorrections,
  LEVEL_BANDS,
  resolveCompanionOutcome,
  resolveOutcome,
  scoreDimension,
  toLevel,
  AWARENESS_WEIGHTS,
  CORRECTION_REFUND,
  CORRECTIONS,
  CRITICAL_RISKS,
  REQUIRED_EVENTS,
  RISK_FIX,
  SAFETY_WEIGHTS,
  type CorrectionDef,
  type CompanionOutcome,
  type ScenarioOutcome,
  type SkillLevel,
} from "./branching";

/**
 * ScenarioEvaluator: превращает телеметрию прохождения в образовательный
 * разбор по трём осям (реакция / маршрут / завершение) и итоговый профиль
 * (safety / awareness / completion → один из четырёх исходов). Чистая
 * функция — без Phaser и React; одинаковые события дают одинаковый итог.
 * Правила — content/fire-school/rules.json, пороги — scenario/branching.ts.
 */

export type DebriefOutcome = "safe" | "risky" | "timeout";
export type AxisGrade = "good" | "mixed" | "poor";
export type RuleCategory = "reaction" | "route" | "completion";

export interface TimelineEntry {
  id: string;
  labelKey: string;
  /** мс от старта сценария */
  t: number;
}

/** Итоговый профиль прохождения (вычисляется только здесь, UI отображает). */
export interface OutcomeProfile {
  outcome: ScenarioOutcome;
  /** уровни навыков — без псевдоточных чисел наружу */
  safety: SkillLevel;
  awareness: SkillLevel;
  completion: SkillLevel;
  teacherInterventions: number;
  /** messageKey исправленных ошибок (для отдельного блока дебрифа) */
  correctedMistakes: string[];
  /** ключ короткого объяснения итога */
  explanationKey: string;
  companion: CompanionOutcome;
}

export interface DebriefReport {
  /** legacy-итог для существующего UI/стилей (safe|risky|timeout) */
  outcome: DebriefOutcome;
  /** branching-итог: 4 образовательных типа прохождения */
  profile: OutcomeProfile;
  timeMs: number;
  /** id первого решения (calm|backpack|rush|assess) или null */
  firstDecision: string | null;
  axes: Record<RuleCategory, AxisGrade>;
  /** messageKey сработавших «правильных» правил (уникальные) */
  goodActions: string[];
  /** messageKey сработавших «опасных» правил (уникальные) */
  riskyActions: string[];
  /** одно правило на следующее прохождение */
  lessonKey: string;
  timeline: TimelineEntry[];
  companion: "none" | "helped" | "safe";
}

export interface EvaluatorEvent {
  id: string;
  t: number;
}

const OUTCOME_EXPLANATION: Record<ScenarioOutcome, string> = {
  safe_independent: "debrief.outcomeText.safeIndependent",
  safe_with_guidance: "debrief.outcomeText.safeGuidance",
  safe_with_risks: "debrief.outcomeText.safeRisks",
  incomplete: "debrief.outcomeText.incomplete",
};

const RULES: EducationalRule[] = parseRules(rulesRaw);

/** События-вехи для timeline (порядок = порядок отображения). */
const TIMELINE_LABELS: Array<{ id: string; labelKey: string }> = [
  { id: "followed_teacher_instruction", labelKey: "debrief.timeline.decision" },
  { id: "returned_for_belongings", labelKey: "debrief.timeline.decision" },
  { id: "rushed_without_assessing", labelKey: "debrief.timeline.decision" },
  { id: "assessed_environment", labelKey: "debrief.timeline.decision" },
  { id: "left_classroom", labelKey: "debrief.timeline.leftClassroom" },
  { id: "helped_student", labelKey: "debrief.timeline.helped" },
  { id: "entered_central_hall", labelKey: "debrief.timeline.centralHall" },
  { id: "smoke_detected", labelKey: "debrief.timeline.smoke" },
  { id: "evacuation_plan_checked", labelKey: "debrief.timeline.planChecked" },
  { id: "safe_exit_sign_detected", labelKey: "debrief.timeline.signDetected" },
  { id: "teacher_intervened", labelKey: "debrief.timeline.teacherIntervened" },
  { id: "used_emergency_exit", labelKey: "debrief.timeline.emergencyExit" },
  { id: "descended_stairs", labelKey: "debrief.timeline.stairs" },
  { id: "exited_building", labelKey: "debrief.timeline.exitedBuilding" },
  { id: "reached_assembly", labelKey: "debrief.timeline.assembly" },
  { id: "reported_to_teacher", labelKey: "debrief.timeline.reported" },
  { id: "time_up", labelKey: "debrief.timeline.timeUp" },
];

/** Приоритет «урока»: первое сработавшее risk-правило с lessonKey. */
const LESSON_PRIORITY = [
  "lingered_in_smoke",
  "attempted_reentry",
  "teacher_intervened",
  "crowd_following_route",
  "pushed_through_crowd",
  "followed_crowd_without_checking",
  "returned_for_belongings",
  "backpack_temptation",
  "rushed_without_assessing",
  "time_up",
];

/**
 * Политика оценки здания: правила разбора, веса, критичные риски,
 * обязательные события. Школа и ТРЦ используют политику по умолчанию;
 * квартира и офис учат другим действиям и приносят свою (пакет сценария).
 */
export interface EvaluationPolicy {
  rules: EducationalRule[];
  awarenessWeights: Record<string, number>;
  safetyWeights: Record<string, number>;
  criticalRisks: readonly string[];
  riskFix: Record<string, string>;
  correctionRefund: Record<string, number>;
  corrections: CorrectionDef[];
  requiredEvents: readonly string[];
  timeline: Array<{ id: string; labelKey: string }>;
  lessonPriority: string[];
}

export const DEFAULT_POLICY: EvaluationPolicy = {
  rules: RULES,
  awarenessWeights: AWARENESS_WEIGHTS,
  safetyWeights: SAFETY_WEIGHTS,
  criticalRisks: CRITICAL_RISKS,
  riskFix: RISK_FIX,
  correctionRefund: CORRECTION_REFUND,
  corrections: CORRECTIONS,
  requiredEvents: REQUIRED_EVENTS,
  timeline: TIMELINE_LABELS,
  lessonPriority: LESSON_PRIORITY,
};

/** Политика здания = политика по умолчанию + переопределения. */
export function extendPolicy(
  overrides: Partial<Omit<EvaluationPolicy, "rules">> & { rules?: unknown },
): EvaluationPolicy {
  return {
    ...DEFAULT_POLICY,
    ...overrides,
    rules: overrides.rules ? parseRules(overrides.rules) : DEFAULT_POLICY.rules,
  };
}

function axisGrade(good: number, risk: number): AxisGrade {
  if (risk === 0) return good > 0 ? "good" : "mixed";
  return good > 0 ? "mixed" : "poor";
}

export function evaluateScenario(input: {
  events: EvaluatorEvent[];
  success: boolean;
  timeMs: number;
  firstDecision: string | null;
  companionHelped: boolean;
  companionSafe: boolean;
  /** сколько раз учитель останавливал игрока (0 по умолчанию) */
  teacherInterventions?: number;
  /** политика здания; по умолчанию — школа */
  policy?: EvaluationPolicy;
}): DebriefReport {
  const policy = input.policy ?? DEFAULT_POLICY;
  const seen = new Set(input.events.map((e) => e.id));
  const teacherInterventions =
    input.teacherInterventions ?? (seen.has("teacher_intervened") ? 1 : 0);

  const matched = policy.rules.filter((rule) => seen.has(rule.event));
  const byCategory = (category: RuleCategory) =>
    matched.filter((rule) => rule.category === category);

  const axes = {} as Record<RuleCategory, AxisGrade>;
  for (const category of ["reaction", "route", "completion"] as const) {
    const rules = byCategory(category);
    axes[category] = axisGrade(
      rules.filter((r) => r.kind === "good").length,
      rules.filter((r) => r.kind === "risk").length,
    );
  }

  const dedupe = (keys: string[]) => [...new Set(keys)];
  const goodActions = dedupe(
    matched.filter((r) => r.kind === "good").map((r) => r.messageKey),
  );
  const riskyActions = dedupe(
    matched.filter((r) => r.kind === "risk").map((r) => r.messageKey),
  );

  const outcome: DebriefOutcome = !input.success
    ? "timeout"
    : riskyActions.length > 0
      ? "risky"
      : "safe";

  const matchedIds = new Set(matched.map((r) => r.id));
  const lessonRuleId = policy.lessonPriority.find((id) => matchedIds.has(id));
  const lessonKey =
    (lessonRuleId &&
      policy.rules.find((r) => r.id === lessonRuleId)?.lessonKey) ||
    "debrief.lesson.default";

  const timeline: TimelineEntry[] = [
    { id: "alarm", labelKey: "debrief.timeline.alarm", t: 0 },
  ];
  for (const { id, labelKey } of policy.timeline) {
    const event = input.events.find((e) => e.id === id);
    if (event) timeline.push({ id, labelKey, t: event.t });
  }
  timeline.sort((a, b) => a.t - b.t);

  // ---- Branching-профиль: safety / awareness / completion → итог ----

  const awarenessScore = scoreDimension(
    seen,
    policy.awarenessWeights,
    true,
    policy.riskFix,
    policy.correctionRefund,
  );
  const safetyScore = scoreDimension(
    seen,
    policy.safetyWeights,
    true,
    policy.riskFix,
    policy.correctionRefund,
  );

  const scenarioOutcome = resolveOutcome({
    success: input.success,
    seen,
    teacherInterventions,
    awarenessScore,
    safetyScore,
    requiredEvents: policy.requiredEvents,
    criticalRisks: policy.criticalRisks,
    riskFix: policy.riskFix,
  });

  // Completion — обязательные критерии, мелкие плюсы их не компенсируют:
  // не завершил → needs_review; завершил с возвратом к зданию → developing.
  const completionLevel: SkillLevel =
    scenarioOutcome === "incomplete"
      ? "needs_review"
      : seen.has("attempted_reentry")
        ? "developing"
        : "strong";

  // Риск при сопровождении: задержка в дыму уже ПОСЛЕ того, как девочка
  // пошла с игроком (помощь не должна подвергать обоих опасности).
  const helpedAt = input.events.find((e) => e.id === "helped_student")?.t;
  const blockedAt = input.events.find((e) => e.id === "route_blocked")?.t;
  const riskyWhileEscorting =
    helpedAt !== undefined && blockedAt !== undefined && blockedAt > helpedAt;

  const profile: OutcomeProfile = {
    outcome: scenarioOutcome,
    safety: toLevel(safetyScore, LEVEL_BANDS.safety),
    awareness: toLevel(awarenessScore, LEVEL_BANDS.awareness),
    completion: completionLevel,
    teacherInterventions,
    correctedMistakes: detectCorrections(seen, policy.corrections),
    explanationKey: OUTCOME_EXPLANATION[scenarioOutcome],
    companion: resolveCompanionOutcome({
      helped: input.companionHelped,
      safeAtAssembly: input.companionSafe,
      riskyWhileEscorting,
    }),
  };

  return {
    outcome,
    profile,
    timeMs: input.timeMs,
    firstDecision: input.firstDecision,
    axes,
    goodActions,
    riskyActions,
    lessonKey,
    timeline,
    companion: input.companionSafe
      ? "safe"
      : input.companionHelped
        ? "helped"
        : "none",
  };
}
