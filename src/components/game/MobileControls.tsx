"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { eventBus, type GameEventMap } from "@/game/EventBus";

const BASE_SIZE = 128;
const KNOB_SIZE = 56;
const MAX_OFFSET = (BASE_SIZE - KNOB_SIZE) / 2;

/**
 * Мобильные контролы для landscape: полупрозрачный джойстик снизу слева и
 * одна контекстная кнопка действия снизу справа. Multitouch: джойстик
 * захватывает свой pointerId, кнопка живёт независимо.
 */
export function MobileControls() {
  const t = useTranslations();
  const baseRef = useRef<HTMLDivElement>(null);
  const pointerId = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [interaction, setInteraction] = useState<
    GameEventMap["interaction:available"] | null
  >(null);
  /** Первые секунды подсказываем, чем двигаться: иначе джойстик не замечают. */
  const [hintVisible, setHintVisible] = useState(true);

  useEffect(() => {
    const unsubscribes = [
      eventBus.on("interaction:available", (payload) =>
        setInteraction(payload),
      ),
      eventBus.on("interaction:cleared", () => setInteraction(null)),
      eventBus.on("scenario:completed", () => setInteraction(null)),
    ];
    return () => {
      unsubscribes.forEach((off) => off());
      // На анмаунт обнуляем вектор, чтобы персонаж не «убежал».
      eventBus.emit("input:move", { x: 0, y: 0 });
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setHintVisible(false), 9000);
    return () => window.clearTimeout(timer);
  }, []);

  const updateVector = (clientX: number, clientY: number) => {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    let dx = clientX - (rect.left + rect.width / 2);
    let dy = clientY - (rect.top + rect.height / 2);
    const length = Math.hypot(dx, dy);
    if (length > MAX_OFFSET) {
      dx = (dx / length) * MAX_OFFSET;
      dy = (dy / length) * MAX_OFFSET;
    }
    setHintVisible(false);
    setKnob({ x: dx, y: dy });
    eventBus.emit("input:move", { x: dx / MAX_OFFSET, y: dy / MAX_OFFSET });
  };

  const releaseJoystick = () => {
    pointerId.current = null;
    setKnob({ x: 0, y: 0 });
    eventBus.emit("input:move", { x: 0, y: 0 });
  };

  return (
    <>
      {hintVisible && (
        <div className="pointer-events-none absolute inset-x-0 bottom-40 z-20 flex justify-center px-6">
          <p className="rounded-xl border border-white/15 bg-navy-950/85 px-4 py-2 text-center text-sm text-white/90 shadow-lg backdrop-blur-sm">
            {t("game.hint.touch")}
          </p>
        </div>
      )}

      {/* Виртуальный джойстик */}
      <div
        ref={baseRef}
        className="absolute bottom-6 left-6 touch-none rounded-full border border-white/20 bg-white/10 backdrop-blur-sm"
        style={{ width: BASE_SIZE, height: BASE_SIZE }}
        onPointerDown={(e) => {
          if (pointerId.current !== null) return;
          pointerId.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          updateVector(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.pointerId !== pointerId.current) return;
          updateVector(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          if (e.pointerId !== pointerId.current) return;
          releaseJoystick();
        }}
        onPointerCancel={(e) => {
          if (e.pointerId !== pointerId.current) return;
          releaseJoystick();
        }}
      >
        <div
          className="pointer-events-none absolute rounded-full bg-white/35"
          style={{
            width: KNOB_SIZE,
            height: KNOB_SIZE,
            left: (BASE_SIZE - KNOB_SIZE) / 2 + knob.x,
            top: (BASE_SIZE - KNOB_SIZE) / 2 + knob.y,
          }}
        />
      </div>

      {/* Контекстная кнопка действия — появляется только рядом с объектом */}
      {interaction && (
        <button
          type="button"
          className="absolute bottom-8 right-6 touch-none rounded-full bg-safe/85 px-6 py-5 text-sm font-bold text-white shadow-xl backdrop-blur-sm active:scale-95"
          onPointerDown={(e) => {
            e.preventDefault();
            eventBus.emit("input:interact");
          }}
        >
          {t(interaction.labelKey)}
        </button>
      )}
    </>
  );
}
