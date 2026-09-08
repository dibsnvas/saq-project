"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import type { QuestOption, QuestRoom } from "@/quest/schema";
import { hotspotPosition, useCoverRect } from "./useCoverRect";

/**
 * Сцена комнаты во весь экран: кадр, который трясёт, и точки выбора прямо
 * на объектах. Кадр растянут по `object-cover`, поэтому координаты точек
 * пересчитываются от реального прямоугольника кадра, а не от контейнера —
 * иначе на широком мониторе точки уезжают с предметов.
 */

export interface SceneOutcome {
  /** выбранный вариант; null — время вышло */
  option: QuestOption | null;
}

export function QuestScene({
  room,
  outcome,
  interactionsEnabled,
  onChoose,
}: {
  room: QuestRoom;
  outcome: SceneOutcome | null;
  /** Выбор открывается только после того, как вопрос прозвучал. */
  interactionsEnabled: boolean;
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

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      <div
        className={`absolute inset-0 bg-cover bg-center ${
          revealed ? "quest-quake-calm" : "quest-quake"
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
          position={
            option.hotspot
              ? hotspotPosition(
                  cover,
                  option.hotspot.x,
                  option.hotspot.y,
                  container,
                )
              : null
          }
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
  onChoose,
}: {
  option: QuestOption;
  revealed: boolean;
  interactionsEnabled: boolean;
  isChosen: boolean;
  label: string;
  position: { left: number; top: number } | null;
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
      type="button"
      onClick={onChoose}
      disabled={revealed || !interactionsEnabled}
      aria-pressed={isChosen}
      aria-label={label}
      style={{ left: position.left, top: position.top }}
      className="absolute z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5 transition-opacity disabled:cursor-default"
    >
      <span className={`h-4 w-4 rounded-full ring-2 ring-navy-950/60 ${dot}`} />
      <span
        className={`whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-semibold leading-none backdrop-blur-sm transition sm:text-sm ${tone}`}
      >
        {label}
      </span>
    </button>
  );
}
