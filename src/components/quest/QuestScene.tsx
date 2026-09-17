"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { QuestOption, QuestRoom } from "@/quest/schema";
import { hotspotPosition, useCoverRect } from "./useCoverRect";

/**
 * Сцена комнаты во весь экран: кадр, который трясёт, и точки выбора прямо
 * на объектах. Кадр растянут по `object-cover`, поэтому координаты точек
 * пересчитываются от реального прямоугольника кадра, а не от контейнера —
 * иначе на широком мониторе точки уезжают с предметов.
 */

/** Отступ подписи от края экрана и между подписями, px. */
const EDGE_GAP = 8;

type Box = { left: number; top: number; width: number; height: number };

/**
 * Раскладка точек на экране: подпись целиком внутри контейнера, а
 * наложившиеся подписи раздвигаются по вертикали. На телефоне кадр 16:9
 * сильно обрезан по бокам, и точки у края иначе слипаются и режутся.
 */
export function layoutHotspots(
  items: Box[],
  container: { width: number; height: number },
): Array<{ left: number; top: number }> {
  const clampX = (b: Box) =>
    Math.min(
      Math.max(b.left, b.width / 2 + EDGE_GAP),
      Math.max(
        b.width / 2 + EDGE_GAP,
        container.width - b.width / 2 - EDGE_GAP,
      ),
    );
  const clampY = (top: number, h: number) =>
    Math.min(
      Math.max(top, h / 2 + EDGE_GAP),
      Math.max(h / 2 + EDGE_GAP, container.height - h / 2 - EDGE_GAP),
    );
  const placed = items.map((b) => ({
    ...b,
    left: clampX(b),
    top: clampY(b.top, b.height),
  }));
  const order = placed
    .map((_, i) => i)
    .sort((a, b) => placed[a].top - placed[b].top);
  for (let k = 1; k < order.length; k += 1) {
    const cur = placed[order[k]];
    for (let j = 0; j < k; j += 1) {
      const prev = placed[order[j]];
      const overlapX =
        Math.abs(cur.left - prev.left) <
        (cur.width + prev.width) / 2 + EDGE_GAP;
      const minDy = (cur.height + prev.height) / 2 + EDGE_GAP;
      if (overlapX && cur.top - prev.top < minDy) cur.top = prev.top + minDy;
    }
  }
  // Упёрлись в низ экрана — сдвигаем всю стопку вверх.
  const last = placed[order[order.length - 1]];
  if (last) {
    const overflow = last.top + last.height / 2 + EDGE_GAP - container.height;
    if (overflow > 0) {
      for (const b of placed) b.top = clampY(b.top - overflow, b.height);
    }
  }
  return placed.map(({ left, top }) => ({ left, top }));
}

export interface SceneOutcome {
  /** выбранный вариант; null — время вышло */
  option: QuestOption | null;
}

export function QuestScene({
  room,
  outcome,
  interactionsEnabled,
  effect,
  onChoose,
}: {
  room: QuestRoom;
  outcome: SceneOutcome | null;
  /** Выбор открывается только после того, как вопрос прозвучал. */
  interactionsEnabled: boolean;
  /** тряска кадра только у землетрясения */
  effect: "quake" | "none";
  onChoose: (option: QuestOption) => void;
}) {
  const t = useTranslations();
  const containerRef = useRef<HTMLDivElement>(null);
  const cover = useCoverRect(containerRef);
  const revealed = outcome !== null;
  const chosenId = outcome?.option?.id ?? null;
  const container = {
    width: cover.width + 2 * cover.left,
    height: cover.height + 2 * cover.top,
  };

  // Размеры подписей меряем после отрисовки: от них зависит раскладка.
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [sizes, setSizes] = useState<Record<string, { w: number; h: number }>>(
    {},
  );
  const labelsKey = room.options
    .map((o) => `${o.id}:${t(o.shortLabelKey)}`)
    .join("|");
  useLayoutEffect(() => {
    const next: Record<string, { w: number; h: number }> = {};
    for (const option of room.options) {
      const el = buttonRefs.current[option.id];
      if (el) next[option.id] = { w: el.offsetWidth, h: el.offsetHeight };
    }
    setSizes((prev) =>
      JSON.stringify(prev) === JSON.stringify(next) ? prev : next,
    );
  }, [labelsKey, container.width, container.height, room.options]);

  const withHotspot = room.options.filter((o) => o.hotspot);
  const raw = withHotspot.map((o) => {
    const pos = hotspotPosition(
      cover,
      o.hotspot!.x,
      o.hotspot!.y,
      container,
      0,
    );
    const size = sizes[o.id] ?? { w: 0, h: 0 };
    return { left: pos.left, top: pos.top, width: size.w, height: size.h };
  });
  const laidOut = layoutHotspots(raw, container);
  const positionOf = (id: string) => {
    const i = withHotspot.findIndex((o) => o.id === id);
    return i < 0 ? null : laidOut[i];
  };

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      <div
        className={`absolute inset-0 bg-cover bg-center ${
          effect === "quake"
            ? revealed
              ? "quest-quake-calm"
              : "quest-quake"
            : ""
        }`}
        style={{
          backgroundImage: `url(${room.background})`,
          filter: "brightness(1.12) saturate(1.05)",
        }}
      />

      {room.options.map((option) => (
        <Hotspot
          key={option.id}
          option={option}
          revealed={revealed}
          interactionsEnabled={interactionsEnabled}
          isChosen={chosenId === option.id}
          onChoose={() => onChoose(option)}
          label={t(option.shortLabelKey)}
          buttonRef={(el) => {
            buttonRefs.current[option.id] = el;
          }}
          position={positionOf(option.id)}
        />
      ))}
    </div>
  );
}

function Hotspot({
  option,
  revealed,
  interactionsEnabled,
  isChosen,
  label,
  position,
  buttonRef,
  onChoose,
}: {
  option: QuestOption;
  revealed: boolean;
  interactionsEnabled: boolean;
  isChosen: boolean;
  label: string;
  position: { left: number; top: number } | null;
  buttonRef: (el: HTMLButtonElement | null) => void;
  onChoose: () => void;
}) {
  if (!option.hotspot || !position) return null;

  const tone = !revealed
    ? interactionsEnabled
      ? "border-white/80 bg-navy-950/80 text-white"
      : "border-white/35 bg-navy-950/65 text-white/60"
    : option.correct
      ? "border-safe bg-safe/85 text-white"
      : isChosen
        ? "border-danger bg-danger/85 text-white"
        : "border-white/25 bg-navy-950/50 text-white/45";

  const dot = !revealed
    ? interactionsEnabled
      ? "bg-white quest-hotspot-pulse"
      : "bg-white/45"
    : option.correct
      ? "bg-safe"
      : isChosen
        ? "bg-danger"
        : "bg-white/40";

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onChoose}
      disabled={revealed || !interactionsEnabled}
      aria-pressed={isChosen}
      aria-label={label}
      style={{ left: position.left, top: position.top }}
      className="absolute z-20 flex w-max -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5 transition-opacity disabled:cursor-default"
    >
      <span className={`h-4 w-4 rounded-full ring-2 ring-navy-950/60 ${dot}`} />
      <span
        className={`w-max max-w-[11.5rem] whitespace-normal text-center rounded-md border px-2.5 py-1 text-xs font-semibold leading-tight sm:max-w-none sm:whitespace-nowrap sm:leading-none backdrop-blur-sm transition sm:text-sm ${tone}`}
      >
        {label}
      </span>
    </button>
  );
}
