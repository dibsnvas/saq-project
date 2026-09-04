"use client";

import { useEffect, useState, type RefObject } from "react";

export interface CoverRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Прямоугольник кадра 16:9, растянутого по `object-cover` внутри контейнера.
 * Нужен для точек выбора: их координаты заданы в процентах кадра, а на
 * полном экране кадр обрезается — без пересчёта точки уезжают с объектов.
 */
export function useCoverRect(
  ref: RefObject<HTMLElement | null>,
  aspect = 16 / 9,
): CoverRect {
  const [rect, setRect] = useState<CoverRect>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const measure = () => {
      const { clientWidth: w, clientHeight: h } = element;
      if (!w || !h) return;
      // cover: масштаб по большей из сторон, лишнее уходит за края поровну.
      const scale = Math.max(w / (aspect * 100), h / 100);
      const width = aspect * 100 * scale;
      const height = 100 * scale;
      setRect({ left: (w - width) / 2, top: (h - height) / 2, width, height });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, aspect]);

  return rect;
}

/**
 * Точка кадра (проценты) → пиксели контейнера. Точку, ушедшую за обрез,
 * прижимаем к краю с отступом: она остаётся нажимаемой на любом экране.
 */
export function hotspotPosition(
  rect: CoverRect,
  x: number,
  y: number,
  container: { width: number; height: number },
  margin = 56,
): { left: number; top: number } {
  const px = rect.left + (rect.width * x) / 100;
  const py = rect.top + (rect.height * y) / 100;
  return {
    left: Math.min(Math.max(px, margin), Math.max(margin, container.width - margin)),
    top: Math.min(Math.max(py, margin), Math.max(margin, container.height - margin)),
  };
}
