import { describe, expect, it } from "vitest";
import ruUi from "@/messages/ru.json";
import kkUi from "@/messages/kk.json";
import { QUESTS } from "./registry";
import type { QuestDefinition } from "./schema";

// Тексты квестов живут в общем словаре интерфейса.
const MESSAGES = { ru: ruUi, kk: kkUi };

function lookup(messages: unknown, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === "object"
          ? (node as Record<string, unknown>)[part]
          : undefined,
      messages,
    );
}

function questKeys(quest: QuestDefinition): string[] {
  const keys = [quest.titleKey];
  if (quest.timeoutNoteKey) keys.push(quest.timeoutNoteKey);
  if (quest.perfectKey) keys.push(quest.perfectKey);
  if (quest.next) keys.push(quest.next.labelKey);
  for (const room of quest.rooms) {
    keys.push(
      room.titleKey,
      room.situationKey,
      room.eventKey,
      room.questionKey,
    );
    for (const option of room.options) {
      keys.push(option.labelKey, option.shortLabelKey, option.explanationKey);
    }
    for (const outcome of Object.values(room.outcomes ?? {})) {
      keys.push(outcome.textKey);
    }
    if (room.bridge) keys.push(room.bridge.textKey);
  }
  return keys;
}

describe("реестр квестов", () => {
  for (const [id, quest] of Object.entries(QUESTS)) {
    it(`${id}: id совпадает с ключом реестра`, () => {
      expect(quest.id).toBe(id);
    });

    for (const locale of ["ru", "kk"] as const) {
      it(`${id}: все тексты есть в локали ${locale}`, () => {
        const missing = questKeys(quest).filter(
          (key) => typeof lookup(MESSAGES[locale], key) !== "string",
        );
        expect(missing).toEqual([]);
      });
    }
  }

});
