import { z } from "zod";

/**
 * Контракт данных сценария. Сцена ничего не знает про конкретный сценарий —
 * она получает провалидированный ScenarioDefinition и передаёт его в системы.
 */

export const rectSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
});

export const triggerZoneSchema = z.object({
  id: z.string().min(1),
  /** комната, в которой активна зона (комнатная система сцен) */
  room: z.string().min(1),
  rect: rectSchema,
  /** id события из scenario.events, отправляемого при входе в зону */
  event: z.string().optional(),
  /** зона срабатывает один раз (по умолчанию) или каждый вход */
  once: z.boolean().default(true),
  /** сколько мс нужно пробыть в зоне: случайное касание края не считается */
  dwellMs: z.number().nonnegative().optional(),
});

export const eventDefinitionSchema = z.object({
  /** ключ локализации для HUD-уведомления (next-intl) */
  messageKey: z.string().optional(),
  severity: z.enum(["info", "warning", "danger"]).default("info"),
});

/** Первое интерактивное решение после сигнала тревоги. */
export const introDecisionSchema = z.object({
  id: z.string().min(1),
  promptKey: z.string().min(1),
  options: z
    .array(
      z.object({
        /** id варианта; без effect он же и эффект (calm|backpack|rush|assess) */
        id: z.string().min(1),
        /**
         * Что делает сцена: calm/assess — спокойный старт, rush — заминка
         * в коридоре, backpack — возврат за вещами, flare — вспышка огня
         * (вода на горящее масло).
         */
        effect: z
          .enum(["calm", "backpack", "rush", "assess", "flare"])
          .optional(),
        labelKey: z.string().min(1),
        /** событие сценария/телеметрии, записываемое при выборе */
        event: z.string().min(1),
      }),
    )
    .min(2),
});

export const scenarioSchema = z.object({
  id: z.string().min(1),
  objectiveKey: z.string().min(1),
  durationSeconds: z.number().int().positive(),
  /** стартовая комната и позиция игрока в ней */
  startRoom: z.string().min(1),
  start: z.object({ x: z.number(), y: z.number() }),
  introDecision: introDecisionSchema,
  zones: z.array(triggerZoneSchema),
  events: z.record(z.string(), eventDefinitionSchema),
  /** id зон ИЛИ событий, которые завершают сценарий */
  completionTriggers: z.array(z.string()).min(1),
});

/**
 * Образовательные правила (data-driven, проверяются специалистом отдельно
 * от кода). Правило срабатывает, если событие встретилось в телеметрии.
 */
export const educationalRuleSchema = z.object({
  id: z.string().min(1),
  category: z.enum(["reaction", "route", "completion"]),
  kind: z.enum(["good", "risk"]),
  /** id события телеметрии, активирующего правило */
  event: z.string().min(1),
  /** ключ локализации короткой формулировки для debrief */
  messageKey: z.string().min(1),
  /** ключ локализации «правила на следующий раз» (для risk-правил) */
  lessonKey: z.string().optional(),
});

export const rulesFileSchema = z.object({
  rules: z.array(educationalRuleSchema).min(1),
});

export type ScenarioRect = z.infer<typeof rectSchema>;
export type TriggerZone = z.infer<typeof triggerZoneSchema>;
export type ScenarioEventDefinition = z.infer<typeof eventDefinitionSchema>;
export type ScenarioDefinition = z.infer<typeof scenarioSchema>;
export type IntroDecision = z.infer<typeof introDecisionSchema>;
export type IntroDecisionOptionId = IntroDecision["options"][number]["id"];
export type EducationalRule = z.infer<typeof educationalRuleSchema>;

export function parseScenario(raw: unknown): ScenarioDefinition {
  return scenarioSchema.parse(raw);
}

export function parseRules(raw: unknown): EducationalRule[] {
  return rulesFileSchema.parse(raw).rules;
}
