import type { AssetEntry } from "../assets";
import type { EvaluationPolicy } from "../scenario/evaluator";
import type {
  FigureRole,
  Point,
  Rect,
  RoomId,
  RoomLayout,
} from "../rooms/types";

/**
 * Пакет сценария: всё, чем одно здание отличается от другого при общей
 * игровой логике. Цепочка комнат-ролей (старт → коридор → холл-развилка →
 * лестница → тамбур → улица), события и правила оценки общие; здание
 * меняет раскладки, арт, NPC, интро, реплики и немного геометрии.
 */
export type ScenarioId =
  "fire-school" | "fire-mall" | "fire-apartment" | "fire-office";

/** Реплики над головами NPC: рисуются в канвасе, поэтому идут мимо i18n. */
export type BubbleKind =
  "together" | "wait" | "accept" | "stay" | "redirect" | "reportAck";

export type VoiceLocale = "ru" | "kk";

/** Вопрос у растерянного NPC: варианты — подмножество трёх веток помощи. */
export interface HelpChoice {
  promptKey: string;
  options: Array<{
    id: "companion" | "referred" | "declined";
    labelKey: string;
  }>;
}

export interface ScenarioPack {
  id: ScenarioId;
  /** scenario.json здания; валидируется Zod-схемой при создании игры */
  scenario: unknown;
  /** комнаты здания; квартире лестница и тамбур не нужны */
  layouts: Partial<Record<RoomId, RoomLayout>>;
  roomEnterMessage: Partial<Record<RoomId, string>>;
  /** фоны, NPC и пропы здания (общие ассеты — в assets.ts) */
  assets: AssetEntry[];
  intro: {
    /** null — ролика нет, интро сразу ведёт к первому решению */
    video: string | null;
    videoByLocale: Partial<Record<string, string>>;
    poster: string;
    /** ключ названия сценария в словаре */
    nameKey: string;
  };
  /** спутник, которому игрок может помочь в коридоре */
  companion: {
    idleTexture: string;
    walkTexture: string;
    role: FigureRole;
    figureFill: number;
    /** где спутник стоит на точке сбора */
    assemblyAt: Point;
  };
  /** политика оценки здания (правила разбора, веса); без неё — школьная */
  policy?: EvaluationPolicy;
  /** механики сцены, которые здание отключает */
  mechanics?: {
    /** «оценил обстановку в коридоре» / «пробежал за толпой» */
    corridorAssess?: boolean;
  };
  /** свой вопрос у растерянного NPC (квартира: сестрёнка) */
  helpChoice?: HelpChoice;
  /** схема мини-карты рассчитана на шесть комнат; квартира её скрывает */
  minimap?: boolean;
  /** следующая локация того же сценария: кнопка в разборе после прохождения */
  next?: { href: string; labelKey: string };
  bubbles: Record<VoiceLocale, Record<BubbleKind, string>>;
  /** короткие голосовые реплики взрослых: voices/<locale>/<name>.mp3 */
  calmVoices: Record<VoiceLocale, string[]>;
  /** геометрия, которая раньше была зашита в сцену */
  geometry: {
    /** где в коридоре стоящий игрок «видит дым вдалеке» */
    corridorViewRect: Rect;
    /** в холле: ниже этой линии игрок считается далеко от дыма */
    hallFarFromSmokeMinY: number;
    /** мягкий отвод игрока от дыма при вмешательстве взрослого */
    interventionPush: Point;
    /** на лестнице: левее этой линии игрок идёт к выходу через толпу */
    stairsTowardExitMaxX: number;
    /** отскок от дверей при попытке вернуться в здание (+ — вправо) */
    reentryPushX: number;
    /** предмет ответа «сначала забрать вещи» */
    backpack: { textureKey: string; fallback: Point };
  };
}
