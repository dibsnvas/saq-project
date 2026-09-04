import { describe, expect, it } from "vitest";
import questRaw from "@/content/earthquake/quest.json";
import { MAX_QUEST_ROOMS, correctOptionOf, parseQuest } from "./schema";
import {
  gradeFor,
  summarizeQuest,
  TIMEOUT_OPTION_ID,
  type QuestAnswer,
} from "./scoring";

const quest = parseQuest(questRaw);

/** Ответы «всё верно» — базовая линия для остальных случаев. */
function allCorrect(): QuestAnswer[] {
  return quest.rooms.map((room, i) => ({
    roomId: room.id,
    optionId: correctOptionOf(room).id,
    correct: true,
    t: i * 1000,
  }));
}

function wrongOptionId(roomId: string): string {
  const room = quest.rooms.find((r) => r.id === roomId)!;
  return room.options.find((o) => !o.correct)!.id;
}

describe("quest.json", () => {
  it("проходит валидацию схемы", () => {
    expect(() => parseQuest(questRaw)).not.toThrow();
  });

  it("содержит не больше комнат, чем разрешает ТЗ", () => {
    expect(quest.rooms.length).toBeLessThanOrEqual(MAX_QUEST_ROOMS);
  });

  it("в каждой комнате ровно два варианта и один верный", () => {
    for (const room of quest.rooms) {
      expect(room.options).toHaveLength(2);
      expect(room.options.filter((o) => o.correct)).toHaveLength(1);
    }
  });

  it("не содержит дублирующихся ключей локализации между комнатами", () => {
    const keys = quest.rooms.flatMap((room) => [
      room.titleKey,
      room.situationKey,
      room.eventKey,
      room.questionKey,
      ...room.options.flatMap((o) => [o.labelKey, o.explanationKey]),
    ]);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("gradeFor", () => {
  it("10 из 10 и 9 из 10 — strong", () => {
    expect(gradeFor(10, 10)).toBe("strong");
    expect(gradeFor(9, 10)).toBe("strong");
  });

  it("6–8 из 10 — developing", () => {
    expect(gradeFor(8, 10)).toBe("developing");
    expect(gradeFor(6, 10)).toBe("developing");
  });

  it("меньше 60% — needs_review", () => {
    expect(gradeFor(5, 10)).toBe("needs_review");
    expect(gradeFor(0, 10)).toBe("needs_review");
  });

  it("не делит на ноль на пустом наборе комнат", () => {
    expect(gradeFor(0, 0)).toBe("needs_review");
  });
});

describe("summarizeQuest", () => {
  it("безошибочное прохождение: нет разборов ошибок", () => {
    const summary = summarizeQuest(quest, allCorrect());
    expect(summary.correctCount).toBe(quest.rooms.length);
    expect(summary.mistakes).toEqual([]);
    expect(summary.grade).toBe("strong");
  });

  it("ошибка даёт разбор с верным вариантом этой комнаты", () => {
    const answers = allCorrect();
    answers[1] = {
      roomId: "elevator",
      optionId: wrongOptionId("elevator"),
      correct: false,
      t: 1000,
    };

    const summary = summarizeQuest(quest, answers);
    expect(summary.correctCount).toBe(quest.rooms.length - 1);
    expect(summary.mistakes).toHaveLength(1);
    expect(summary.mistakes[0].roomId).toBe("elevator");
    expect(summary.mistakes[0].correctLabelKey).toBe(
      "quest.room.elevator.option.all_floors.label",
    );
  });

  it("незаконченный квест: неотвеченные комнаты попадают в разбор", () => {
    const summary = summarizeQuest(quest, allCorrect().slice(0, 3));
    expect(summary.correctCount).toBe(3);
    expect(summary.mistakes).toHaveLength(quest.rooms.length - 3);
  });

  it("порядок разборов совпадает с порядком комнат", () => {
    const summary = summarizeQuest(quest, []);
    expect(summary.mistakes.map((m) => m.roomId)).toEqual(
      quest.rooms.map((r) => r.id),
    );
  });

  it("повторный ответ по комнате не удваивает счёт", () => {
    const first = quest.rooms[0];
    const answers: QuestAnswer[] = [
      { roomId: first.id, optionId: wrongOptionId(first.id), correct: false, t: 0 },
      { roomId: first.id, optionId: correctOptionOf(first).id, correct: true, t: 10 },
    ];
    expect(summarizeQuest(quest, answers).correctCount).toBe(1);
  });
  it("не успел решить: комната идёт в ошибки с верным вариантом", () => {
    const answers = allCorrect();
    answers[5] = {
      roomId: "car",
      optionId: TIMEOUT_OPTION_ID,
      correct: false,
      t: 12_000,
    };

    const summary = summarizeQuest(quest, answers);
    expect(summary.correctCount).toBe(quest.rooms.length - 1);
    expect(summary.mistakes.map((m) => m.roomId)).toEqual(["car"]);
    expect(summary.mistakes[0].correctLabelKey).toBe(
      "quest.room.car.option.stop_open.label",
    );
  });
});

describe("сцены комнат", () => {
  it("у каждой комнаты есть фон и хотспоты для обоих вариантов", () => {
    for (const room of quest.rooms) {
      expect(room.background, room.id).toBeTruthy();
      for (const option of room.options) {
        expect(option.hotspot, `${room.id}.${option.id}`).toBeTruthy();
      }
    }
  });

  it("хотспоты вариантов не накладываются друг на друга", () => {
    for (const room of quest.rooms) {
      const [a, b] = room.options.map((o) => o.hotspot!);
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      expect(distance, room.id).toBeGreaterThan(12);
    }
  });

  it("время на решение задано и разумно", () => {
    expect(quest.decisionSeconds).toBeGreaterThanOrEqual(8);
    expect(quest.decisionSeconds).toBeLessThanOrEqual(30);
  });
});

describe("хронология комнат", () => {
  it("у каждого варианта есть кадр-последствие", () => {
    for (const room of quest.rooms) {
      expect(room.outcomes, room.id).toBeTruthy();
      for (const option of room.options) {
        expect(room.outcomes![option.id], `${room.id}.${option.id}`).toBeTruthy();
      }
    }
  });

  it("переход есть у всех комнат, кроме последней", () => {
    const withoutBridge = quest.rooms.filter((r) => !r.bridge);
    expect(withoutBridge).toHaveLength(1);
    expect(withoutBridge[0].id).toBe(quest.rooms.at(-1)!.id);
  });

  it("кадры последствий не переиспользуются между вариантами", () => {
    const images = quest.rooms.flatMap((r) =>
      Object.values(r.outcomes ?? {}).map((o) => o.image),
    );
    expect(new Set(images).size).toBe(images.length);
  });
});

describe("медиа хронологии", () => {
  it("каждый объявленный файл лежит в public", async () => {
    const { existsSync } = await import("node:fs");
    const missing: string[] = [];
    const check = (path?: string) => {
      if (path && !existsSync(`public${path}`)) missing.push(path);
    };
    for (const room of quest.rooms) {
      check(room.background);
      check(room.intro?.video);
      for (const outcome of Object.values(room.outcomes ?? {})) {
        check(outcome.image);
        check(outcome.video);
      }
      check(room.bridge?.image);
      check(room.bridge?.video);
    }
    expect(missing).toEqual([]);
  });
});
