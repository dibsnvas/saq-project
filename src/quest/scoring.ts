import type { QuestDefinition, QuestRoom } from "./schema";
import { correctOptionOf } from "./schema";

/**
 * Подсчёт итога квеста — чистые функции без React: одинаковые ответы всегда
 * дают одинаковый результат. UI только отображает готовый summary.
 */

export type QuestGrade = "strong" | "developing" | "needs_review";

/**
 * Доли верных ответов для уровней. 0.9 — почти без ошибок (9 из 10);
 * 0.6 — база усвоена, но есть пробелы; ниже — разбор нужен целиком.
 */
export const GRADE_BANDS = {
  strong: 0.9,
  developing: 0.6,
} as const;

/** Игрок не успел решить: комната засчитывается как ошибка. */
export const TIMEOUT_OPTION_ID = "__timeout__";

export interface QuestAnswer {
  roomId: string;
  optionId: string;
  correct: boolean;
  /** мс от начала квеста (для телеметрии; на итог не влияет) */
  t: number;
}

export interface QuestMistake {
  roomId: string;
  roomTitleKey: string;
  /** что нужно было сделать — разбор верного варианта */
  correctLabelKey: string;
  explanationKey: string;
}

export interface QuestSummary {
  correctCount: number;
  total: number;
  grade: QuestGrade;
  mistakes: QuestMistake[];
}

export function gradeFor(correctCount: number, total: number): QuestGrade {
  if (total <= 0) return "needs_review";
  const ratio = correctCount / total;
  if (ratio >= GRADE_BANDS.strong) return "strong";
  if (ratio >= GRADE_BANDS.developing) return "developing";
  return "needs_review";
}

export function summarizeQuest(
  quest: QuestDefinition,
  answers: readonly QuestAnswer[],
): QuestSummary {
  const byRoom = new Map<string, QuestAnswer>();
  for (const answer of answers) byRoom.set(answer.roomId, answer);

  const mistakes: QuestMistake[] = [];
  let correctCount = 0;

  for (const room of quest.rooms) {
    const answer = byRoom.get(room.id);
    if (answer?.correct) {
      correctCount += 1;
      continue;
    }
    // Пропущенная комната считается непройденной: разбор всё равно нужен.
    mistakes.push(mistakeOf(room));
  }

  return {
    correctCount,
    total: quest.rooms.length,
    grade: gradeFor(correctCount, quest.rooms.length),
    mistakes,
  };
}

function mistakeOf(room: QuestRoom): QuestMistake {
  const correct = correctOptionOf(room);
  return {
    roomId: room.id,
    roomTitleKey: room.titleKey,
    correctLabelKey: correct.labelKey,
    explanationKey: correct.explanationKey,
  };
}
