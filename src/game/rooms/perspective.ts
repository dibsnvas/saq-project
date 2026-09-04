import type { FigureRole, PerspectiveScale } from "./types";

/**
 * Доля роста взрослого на той же глубине.
 * Подросток ≈ 68–80% двери при взрослом ≈ 78–88% двери → ~0.88 от взрослого.
 */
const ROLE_RATIO: Record<FigureRole, number> = {
  adult: 1,
  teen: 0.88,
  child: 0.72,
};

/** Нормализованная глубина между farY и nearY: 0 — далеко, 1 — близко. */
export function perspectiveT(p: PerspectiveScale, y: number): number {
  const t = (y - p.farY) / (p.nearY - p.farY);
  return Math.min(1, Math.max(0, t));
}

/** Экранная высота взрослого на глубине y (линейная калибровка якорей). */
export function adultHeightAt(p: PerspectiveScale, y: number): number {
  return (
    p.farAdultHeight +
    (p.nearAdultHeight - p.farAdultHeight) * perspectiveT(p, y)
  );
}

/**
 * Целевая экранная высота фигуры (один человек) на глубине y.
 * Групповые спрайты масштабируются через figureFill (доля высоты кадра,
 * которую занимает самый высокий человек в композиции).
 */
export function figureHeightAt(
  p: PerspectiveScale,
  y: number,
  role: FigureRole,
): number {
  return adultHeightAt(p, y) * ROLE_RATIO[role];
}

/**
 * Display-высота спрайта: фигура / figureFill.
 * figureFill = 1 для одиночного персонажа; ~0.88–0.95 для групп,
 * где в кадре есть запас неба/пола вокруг людей.
 */
export function spriteDisplayHeight(
  p: PerspectiveScale,
  y: number,
  role: FigureRole,
  figureFill = 1,
): number {
  const fill = Math.min(1, Math.max(0.35, figureFill));
  return figureHeightAt(p, y, role) / fill;
}

/** Phaser scale = displayHeight / textureHeight. */
export function spriteScale(
  p: PerspectiveScale,
  y: number,
  role: FigureRole,
  textureHeight: number,
  figureFill = 1,
): number {
  if (textureHeight <= 0) return 1;
  return spriteDisplayHeight(p, y, role, figureFill) / textureHeight;
}
