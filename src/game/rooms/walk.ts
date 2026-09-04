import { adultHeightAt, perspectiveT, spriteScale } from "./perspective";
import type {
  FigureRole,
  PerspectiveScale,
  WalkArea,
} from "./types";

/** Нормализованная глубина точки на полу: 0 — дальняя граница, 1 — ближняя. */
export function walkT(walk: WalkArea, y: number): number {
  const t = (y - walk.yTop) / (walk.yBottom - walk.yTop);
  return Math.min(1, Math.max(0, t));
}

/** Горизонтальные границы пола на глубине y (линейная интерполяция трапеции). */
export function xBoundsAt(walk: WalkArea, y: number): { min: number; max: number } {
  const t = walkT(walk, y);
  return {
    min: walk.xTopMin + (walk.xBottomMin - walk.xTopMin) * t,
    max: walk.xTopMax + (walk.xBottomMax - walk.xTopMax) * t,
  };
}

/** Прижимает точку к проходимой области. */
export function clampToWalk(
  walk: WalkArea,
  x: number,
  y: number,
): { x: number; y: number } {
  const cy = Math.min(walk.yBottom, Math.max(walk.yTop, y));
  const { min, max } = xBoundsAt(walk, cy);
  return { x: Math.min(max, Math.max(min, x)), y: cy };
}

/** Phaser-scale спрайта роли на глубине y. */
export function scaleAtDepth(
  perspective: PerspectiveScale,
  y: number,
  role: FigureRole,
  textureHeight: number,
  figureFill = 1,
): number {
  return spriteScale(perspective, y, role, textureHeight, figureFill);
}

/**
 * Относительный масштаб глубины (1 на nearY) — скорость и твины walker'ов.
 */
export function depthNorm(
  perspective: PerspectiveScale,
  y: number,
): number {
  const near = adultHeightAt(perspective, perspective.nearY);
  if (near <= 0) return 1;
  return adultHeightAt(perspective, y) / near;
}

/** t перспективы по якорям комнаты (для отладки / мини-карты). */
export function perspectiveDepth(
  perspective: PerspectiveScale,
  y: number,
): number {
  return perspectiveT(perspective, y);
}
