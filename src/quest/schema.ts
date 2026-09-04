import { z } from "zod";

/**
 * Контракт данных квеста «Землетрясение: правильная реакция».
 * Комнаты — данные (content/earthquake/quest.json), тексты — локали
 * (src/messages/*.json). UI ничего не знает о конкретных ситуациях:
 * новая комната = новый объект в JSON + ключи в двух локалях.
 */

export const QUEST_ICONS = [
  "apartment",
  "elevator",
  "school",
  "mall",
  "street",
  "car",
  "night",
  "gas",
  "help",
  "evacuation",
] as const;

/** Точка на фоне комнаты в процентах от кадра (0–100), а не в пикселях:
 *  сцена масштабируется под ширину экрана. */
export const hotspotSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
});

export const questOptionSchema = z.object({
  id: z.string().min(1),
  labelKey: z.string().min(1),
  /** короткая подпись на сцене (2–3 слова), полный текст — в labelKey */
  shortLabelKey: z.string().min(1),
  /** куда на фоне комнаты нажимать; без hotspot вариант доступен кнопкой */
  hotspot: hotspotSchema.optional(),
  /** короткий разбор: почему это верно / чем опасно */
  explanationKey: z.string().min(1),
  correct: z.boolean(),
});

/**
 * Кадр-последствие выбора: камера уходит туда, куда игрок себя отправил
 * (под стол, к панели лифта, в тёмный подъезд). Показывается сразу после
 * выбора, до разбора.
 */
export const questOutcomeSchema = z.object({
  image: z.string().min(1),
  /** видеоклип последствия; кадр image остаётся постером и запасным вариантом */
  video: z.string().optional(),
  /** что происходит в кадре — одна фраза от первого лица */
  textKey: z.string().min(1),
  /** необязательная реплика голосом (например, ответ диспетчера) */
  voice: z.string().optional(),
});

/**
 * Вступительный клип комнаты: персонаж входит, подходит, поворачивается —
 * и только после этого появляется вопрос. Постером и запасным вариантом
 * служит фон комнаты: клип на нём и заканчивается, поэтому склейки нет.
 */
export const questIntroSchema = z.object({
  video: z.string().min(1),
});

/** Переход в следующую комнату: время, место, одно действие. */
export const questBridgeSchema = z.object({
  image: z.string().min(1),
  /** видеоклип перехода; без него показывается кадр image */
  video: z.string().optional(),
  textKey: z.string().min(1),
});

export const questRoomSchema = z.object({
  id: z.string().min(1),
  icon: z.enum(QUEST_ICONS),
  /** фон комнаты; без него комната показывается карточкой с кнопками */
  background: z.string().min(1).optional(),
  /** клип входа в комнату; проигрывается до появления вопроса */
  intro: questIntroSchema.optional(),
  titleKey: z.string().min(1),
  /** описание ситуации до события */
  situationKey: z.string().min(1),
  /** что происходит (толчок, паника, запах газа) */
  eventKey: z.string().min(1),
  questionKey: z.string().min(1),
  /** по ТЗ ровно два варианта: выбор должен быть быстрым и однозначным */
  options: z.tuple([questOptionSchema, questOptionSchema]),
  /** кадр-последствие для каждого варианта (ключ — id варианта) */
  outcomes: z.record(z.string(), questOutcomeSchema).optional(),
  /** переход к следующей комнате; у последней комнаты его нет */
  bridge: questBridgeSchema.optional(),
});

/** ТЗ: до 10 комнат, 10–15 минут прохождения. */
export const MAX_QUEST_ROOMS = 10;

export const questSchema = z
  .object({
    id: z.string().min(1),
    titleKey: z.string().min(1),
    /** сколько секунд даётся на решение в комнате со сценой */
    decisionSeconds: z.number().int().positive(),
    rooms: z.array(questRoomSchema).min(1).max(MAX_QUEST_ROOMS),
  })
  .superRefine((quest, ctx) => {
    const seenRooms = new Set<string>();
    for (const room of quest.rooms) {
      if (seenRooms.has(room.id)) {
        ctx.addIssue({
          code: "custom",
          message: `Дублирующийся id комнаты: ${room.id}`,
        });
      }
      seenRooms.add(room.id);

      // Ровно один верный вариант: иначе разбор и подсчёт теряют смысл.
      const correctCount = room.options.filter((o) => o.correct).length;
      if (correctCount !== 1) {
        ctx.addIssue({
          code: "custom",
          message: `Комната ${room.id}: верных вариантов ${correctCount}, нужен ровно 1`,
        });
      }
      if (room.options[0].id === room.options[1].id) {
        ctx.addIssue({
          code: "custom",
          message: `Комната ${room.id}: id вариантов совпадают`,
        });
      }
      // Последствие должно быть у каждого варианта, иначе после выбора
      // у одного из них кадр «проваливается».
      if (room.outcomes) {
        for (const option of room.options) {
          if (!room.outcomes[option.id]) {
            ctx.addIssue({
              code: "custom",
              message: `Комната ${room.id}: нет outcome для варианта ${option.id}`,
            });
          }
        }
      }
      // Фон без хотспотов = сцена, по которой некуда нажать.
      if (room.background && room.options.some((o) => !o.hotspot)) {
        ctx.addIssue({
          code: "custom",
          message: `Комната ${room.id}: есть фон, но у варианта нет hotspot`,
        });
      }
    }
  });

export type Hotspot = z.infer<typeof hotspotSchema>;
export type QuestIntro = z.infer<typeof questIntroSchema>;
export type QuestOutcome = z.infer<typeof questOutcomeSchema>;
export type QuestBridge = z.infer<typeof questBridgeSchema>;
export type QuestOption = z.infer<typeof questOptionSchema>;
export type QuestRoom = z.infer<typeof questRoomSchema>;
export type QuestDefinition = z.infer<typeof questSchema>;
export type QuestIcon = (typeof QUEST_ICONS)[number];

/** Битый quest.json падает громко и сразу, а не посреди прохождения. */
export function parseQuest(raw: unknown): QuestDefinition {
  return questSchema.parse(raw);
}

export function correctOptionOf(room: QuestRoom): QuestOption {
  // Наличие ровно одного верного варианта гарантировано схемой.
  return room.options.find((o) => o.correct) ?? room.options[0];
}
