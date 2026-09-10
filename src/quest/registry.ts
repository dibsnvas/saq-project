import earthquakeRaw from "@/content/earthquake/quest.json";
import { parseQuest, type QuestDefinition } from "./schema";

/**
 * Все квесты в формате «ситуация → вопрос → два варианта → разбор».
 * Битый quest.json падает громко при загрузке модуля, а не посреди игры.
 */
export type QuestId = "earthquake";

export const QUESTS: Record<QuestId, QuestDefinition> = {
  earthquake: parseQuest(earthquakeRaw),
};
