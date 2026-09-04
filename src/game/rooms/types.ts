/**
 * Типы комнатной (scene-based) системы. Каждая комната — один фон-кадр
 * 1280×720, трапеция проходимого пола (перспектива), точки входа, хотспоты
 * взаимодействий, переходы, NPC и эффекты. Всё — данные, не логика.
 */

export type RoomId =
  | "classroom"
  | "corridor"
  | "central_hall"
  | "stairs"
  | "vestibule"
  | "outdoor";

export type FigureRole = "adult" | "teen" | "child";

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Проходимая область — трапеция: на глубине yTop коридор для ног игрока
 * от xTopMin до xTopMax, на переднем плане yBottom — от xBottomMin до
 * xBottomMax. Между ними границы интерполируются линейно.
 */
export interface WalkArea {
  yTop: number;
  yBottom: number;
  xTopMin: number;
  xTopMax: number;
  xBottomMin: number;
  xBottomMax: number;
}

/**
 * Калибровка перспективы комнаты: два якоря на полу с ожидаемой
 * экранной высотой взрослого. Масштаб NPC/игрока считается из роли
 * (adult/teen) и figureFill — без произвольных height: 118/152/212.
 */
export interface PerspectiveScale {
  farY: number;
  farAdultHeight: number;
  nearY: number;
  nearAdultHeight: number;
}

/** Переход в другую комнату. */
export interface RoomExit {
  id: string;
  /** точка на полу, рядом с которой доступно действие */
  at: Point;
  radius: number;
  labelKey: string;
  target: RoomId;
  /** id точки спавна в целевой комнате */
  spawn: string;
  /** телеметрия при использовании */
  telemetryEvent: string;
}

/** Зона автоперехода: наступил — перешёл (например, спуск по лестнице). */
export interface RoomAutoExit {
  rect: Rect;
  target: RoomId;
  spawn: string;
  telemetryEvent: string;
}

/** Локальное взаимодействие без перехода (рюкзак, помощь NPC). */
export interface RoomHotspot {
  id: string;
  at: Point;
  radius: number;
  labelKey: string;
  /** id события сценария, которое диспатчится при взаимодействии */
  scenarioEvent: string;
  /** скрыть хотспот после первого использования */
  once: boolean;
}

export interface RoomProp {
  textureKey: string;
  at: Point;
  /** высота на экране, px; ширина по пропорции текстуры */
  height: number;
  flipX?: boolean;
  /** прибавка к depth (по умолчанию depth = at.y) */
  depthBias?: number;
}

export type NpcBehavior =
  | { kind: "idle_sway" }
  | {
      kind: "walker";
      to: Point;
      duration: number;
      /** пауза перед повтором; без повтора — undefined */
      repeatDelay?: number;
      fadeAtEnd: boolean;
    }
  | {
      /**
       * «Толпа сначала идёт к привычному выходу, останавливается из-за дыма
       * и поворачивает к безопасному» — учит не идти слепо за потоком.
       */
      kind: "redirect";
      toward: Point;
      towardDuration: number;
      pauseMs: number;
      then: Point;
      thenDuration: number;
      repeatDelay?: number;
    }
  | {
      kind: "confused";
      /** id хотспота помощи, который активирует следование */
      helpHotspotId: string;
      followTexture: string;
    };

/**
 * Переиспользуемый waypoint-маршрут NPC: выход из-за парты → межрядный
 * проход → движение по проходу → поворот к двери. NPC никогда не движется
 * к цели напрямую через мебель.
 */
export interface NpcRoute {
  id: string;
  waypoints: Point[];
}

/** Scripted-эвакуация NPC класса после первого решения игрока. */
export interface NpcEvacuationPlan {
  /** задержка после старта эвакуации, мс (уходят не одновременно) */
  delay: number;
  /** id маршрута (для оверлея ?debugNpcPaths=1) */
  routeId?: string;
  /**
   * Полный waypoint-путь (включая последнюю точку у двери). Длительность
   * каждого сегмента пропорциональна его длине.
   */
  waypoints: Point[];
  /** суммарная длительность всего пути, мс */
  duration: number;
  /** текстура на время движения (walk-кадр) */
  walkTexture?: string;
}

export interface RoomNpc {
  id: string;
  textureKey: string;
  at: Point;
  /** роль фигуры → доля роста взрослого на той же глубине */
  role: FigureRole;
  /**
   * Доля высоты спрайта, занятая самым высоким человеком.
   * 1 — одиночный персонаж; ~0.88–0.95 — группа.
   */
  figureFill?: number;
  flipX?: boolean;
  behavior: NpcBehavior;
  /** если задан — NPC уходит из комнаты по команде beginEvacuation() */
  evacuate?: NpcEvacuationPlan;
}

export interface SmokeFxDef {
  at: Point;
  /** ключ анимации дыма (FX_ANIM) */
  anim: string;
  scale: number;
  alpha: number;
  /** горизонтальный дрейф, px */
  drift: number;
}

/**
 * Стадии постепенного задымления decision-комнаты (central hall).
 * Дым нарастает слоями, а не включается стеной при входе.
 */
export type SmokeStage = "none" | "distant" | "light" | "medium" | "blocked";

/** Слой эффектов, добавляемый при достижении стадии (низшие остаются). */
export interface SmokeStageFx {
  smoke?: SmokeFxDef[];
  haze?: { rect: Rect; textureKey: string; alpha: number };
}

/**
 * Тайминги staged-прогрессии дыма. Стадии двигают и таймеры, и близость
 * игрока к главному маршруту (approachRect), и реакция NPC — не только
 * абсолютное время.
 */
export interface SmokeProgression {
  /** distant → light: по таймеру или при входе игрока в approachRect */
  lightAfterMs: number;
  /** light → medium: реакция NPC/учителя (по таймеру или близости) */
  mediumAfterMs: number;
  /** medium → blocked: плотный дым только в дальней части главного маршрута */
  blockedAfterMs: number;
  /** приближение к главному маршруту ускоряет прогрессию на одну стадию */
  approachRect: Rect;
}

export interface RoomFx {
  smoke?: SmokeFxDef[];
  /** полупрозрачная дымка поверх опасной области */
  haze?: { rect: Rect; textureKey: string; alpha: number };
  /** послойный дым по стадиям (см. SmokeStage) */
  smokeStages?: Partial<Record<Exclude<SmokeStage, "none">, SmokeStageFx>>;
  /** тревожная красная пульсация (после события пожара) */
  alarm?: boolean;
  /** пылинки в воздухе */
  dust?: boolean;
}

/** Зона замедления (плотная толпа): скорость игрока умножается на factor. */
export interface SlowZone {
  rect: Rect;
  factor: number;
}

export interface RoomLayout {
  id: RoomId;
  backgroundKey: string;
  walk: WalkArea;
  /** калибровка экранной высоты взрослых по глубине */
  perspective: PerspectiveScale;
  /** роль игрока в этой комнате (школьник = teen) */
  playerRole: FigureRole;
  spawns: Record<string, Point>;
  exits: RoomExit[];
  autoExits: RoomAutoExit[];
  hotspots: RoomHotspot[];
  props: RoomProp[];
  npcs: RoomNpc[];
  fx: RoomFx;
  /** ключ цели, показываемой в HUD при входе в комнату (если меняется) */
  objectiveKey?: string;
  /**
   * Опасная зона: задержка в ней даёт предупреждение (событие входа
   * обрабатывает зона сценария в scenario.json).
   */
  dangerZone?: { rect: Rect; lingerEvent: string; lingerMs: number };
  /** staged-прогрессия дыма (decision-комната) */
  smokeProgression?: SmokeProgression;
  /** непроходимая мебель (парты, столы) — прямоугольники «пола под ногами» */
  obstacles?: Rect[];
  /** зоны замедления (плотная толпа на лестнице) */
  slowZones?: SlowZone[];
  /** подсвеченный спокойный проход (зелёная полоса на полу) */
  calmLane?: Rect;
}
