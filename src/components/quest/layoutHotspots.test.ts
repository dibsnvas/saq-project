import { afterEach, describe, expect, it, vi } from "vitest";
import { layoutHotspots } from "./QuestScene";

/**
 * Подписи точек выбора не должны налезать друг на друга и уходить за экран.
 * Числа взяты с телефона: вертикально 390×844 и горизонтально 844×390,
 * где свободная полоса между панелью вопроса и плашкой события узкая.
 */
const overlap = (
  a: { left: number; top: number },
  b: { left: number; top: number },
  size: { width: number; height: number },
) =>
  Math.abs(a.left - b.left) < size.width &&
  Math.abs(a.top - b.top) < size.height;

describe("раскладка точек выбора", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("разводит подписи, когда панели оставили узкую полосу", () => {
    // Телефон лёжа: панель вопроса кончается на 233, плашка события с 288.
    vi.stubGlobal("document", {
      querySelector: (sel: string) => ({
        getBoundingClientRect: () => ({
          bottom: sel.includes("question") ? 233 : 0,
          top: 288,
        }),
        firstElementChild: { getBoundingClientRect: () => ({ top: 288 }) },
      }),
    });
    const [a, b] = layoutHotspots(
      [
        { left: 573.92, top: 171.26, width: 177, height: 46 },
        { left: 768.04, top: 251.97, width: 216, height: 46 },
      ],
      { width: 844, height: 390 },
    );
    expect(overlap(a, b, { width: (177 + 216) / 2, height: 46 })).toBe(false);
  });

  it("разводит подписи в узкой полосе (телефон лёжа)", () => {
    const container = { width: 844, height: 390 };
    const items = [
      { left: 574, top: 239, width: 177, height: 46 },
      { left: 728, top: 283, width: 216, height: 46 },
    ];
    const [a, b] = layoutHotspots(items, container);
    expect(overlap(a, b, { width: (177 + 216) / 2, height: 46 })).toBe(false);
  });

  it("держит подпись целиком на экране", () => {
    const container = { width: 390, height: 844 };
    const items = [
      { left: 4, top: 700, width: 184, height: 62 },
      { left: 386, top: 120, width: 150, height: 47 },
    ];
    const placed = layoutHotspots(items, container);
    placed.forEach((p, i) => {
      const { width, height } = items[i];
      expect(p.left - width / 2).toBeGreaterThanOrEqual(0);
      expect(p.left + width / 2).toBeLessThanOrEqual(container.width);
      expect(p.top - height / 2).toBeGreaterThanOrEqual(0);
      expect(p.top + height / 2).toBeLessThanOrEqual(container.height);
    });
  });

  it("не трогает точки, которые и так не мешают друг другу", () => {
    const container = { width: 1280, height: 720 };
    const items = [
      { left: 300, top: 400, width: 160, height: 46 },
      { left: 900, top: 300, width: 160, height: 46 },
    ];
    expect(layoutHotspots(items, container)).toEqual([
      { left: 300, top: 400 },
      { left: 900, top: 300 },
    ]);
  });
});
