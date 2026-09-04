/**
 * Константы игры без зависимостей. Отдельный модуль, чтобы сцены и config.ts
 * не образовывали циклический импорт (config → сцены → config).
 */

/** Логическое разрешение игры; Scale.FIT сохраняет пропорции в любом окне. */
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

/** Базовый зум камеры: лёгкий парллакс-дрейф за игроком внутри кадра. */
export const BASE_ZOOM = 1.06;

/** Скорость игрока на переднем плане, px/s; в глубине масштабируется. */
export const PLAYER_SPEED = 300;

export const REGISTRY_SCENARIO_KEY = "scenario";
/** Dev-only: `?debugPerspective=1` — оверлей якорей/высот персонажей. */
export const REGISTRY_DEBUG_PERSPECTIVE = "debugPerspective";
/** Dev-only: `?debugCollisions=1` — walkable-зона, препятствия, радиусы. */
export const REGISTRY_DEBUG_COLLISIONS = "debugCollisions";
/** Dev-only: `?debugNpcPaths=1` — waypoint-маршруты NPC и их текущие цели. */
export const REGISTRY_DEBUG_NPC_PATHS = "debugNpcPaths";

/**
 * Палитра UI-элементов канваса (прогресс-бар, дебриф).
 * Семантика: красный — только опасность, зелёный — только безопасный выход.
 */
export const PALETTE = {
  background: 0x0a1526,
  danger: 0xd83a3a,
  safe: 0x2fae5f,
} as const;
