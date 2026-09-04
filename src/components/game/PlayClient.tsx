"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { eventBus } from "@/game/EventBus";
import { audioManager } from "@/game/audio/AudioManager";
import {
  shouldShowDecisionOverlay,
  type PlayPhase,
} from "@/game/playPhase";
import { GameHud } from "./GameHud";
import { IntroOverlay } from "./IntroOverlay";
import { DecisionOverlay } from "./DecisionOverlay";
import { ChoiceOverlay } from "./ChoiceOverlay";
import { MobileControls } from "./MobileControls";
import { OrientationGuard } from "./OrientationGuard";

// Phaser живёт только в браузере: динамический импорт без SSR.
const GameCanvas = dynamic(() => import("./GameCanvas"), { ssr: false });

const POSTER_SRC = "/assets/backgrounds/classroom_students_poster.jpg";

interface DeviceState {
  coarse: boolean;
  portrait: boolean;
}

type ScreenOrientationWithLock = ScreenOrientation & {
  lock?: (orientation: string) => Promise<void>;
};

/**
 * Клиентская оболочка игры: определяет тип устройства и ориентацию,
 * ведёт фазы «интро → решение → игра», монтирует Canvas один раз
 * и собирает HUD + мобильные контролы.
 *
 * Важно: DecisionOverlay показывается сразу в фазе decision и НЕ ждёт
 * Phaser preload / снятия постера (раньше это давало ~20 с пустого экрана).
 */
export function PlayClient() {
  const t = useTranslations();
  const [device, setDevice] = useState<DeviceState | null>(null);
  const [phase, setPhase] = useState<PlayPhase>("intro");
  const [posterVisible, setPosterVisible] = useState(true);
  const [posterFading, setPosterFading] = useState(false);

  useEffect(() => {
    const coarseQuery = window.matchMedia("(pointer: coarse)");
    const portraitQuery = window.matchMedia("(orientation: portrait)");

    const sync = () =>
      setDevice({
        coarse: coarseQuery.matches,
        portrait: portraitQuery.matches,
      });

    sync();
    coarseQuery.addEventListener("change", sync);
    portraitQuery.addEventListener("change", sync);
    return () => {
      coarseQuery.removeEventListener("change", sync);
      portraitQuery.removeEventListener("change", sync);
    };
  }, []);

  // Canvas готов → плавно убираем постер (решение уже видно поверх).
  useEffect(() => {
    return eventBus.on("game:ready", () => {
      window.setTimeout(() => setPosterFading(true), 250);
      window.setTimeout(() => setPosterVisible(false), 900);
    });
  }, []);

  useEffect(() => {
    return eventBus.on("game:restart", () => {
      setPosterVisible(true);
      setPosterFading(false);
      setPhase("decision");
    });
  }, []);

  useEffect(() => {
    const unlock = () => void audioManager.unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  useEffect(() => {
    if (!device?.coarse) return;
    const tryLock = () => {
      const orientation = screen.orientation as ScreenOrientationWithLock;
      orientation.lock?.("landscape").catch(() => {
        /* не поддерживается или запрещено — это нормально */
      });
    };
    window.addEventListener("pointerdown", tryLock, { once: true });
    return () => window.removeEventListener("pointerdown", tryLock);
  }, [device?.coarse]);

  if (!device) {
    return (
      <div className="flex h-dvh items-center justify-center bg-navy-950">
        <p className="text-sm text-white/50">{t("hud.loading")}</p>
      </div>
    );
  }

  if (device.coarse && device.portrait) {
    return <OrientationGuard />;
  }

  const showDecision = shouldShowDecisionOverlay(phase);

  return (
    <div className="relative h-dvh w-full touch-none overflow-hidden bg-navy-950">
      {phase !== "intro" && (
        <>
          <GameCanvas />
          <GameHud isTouch={device.coarse} />
          {device.coarse && phase === "game" && <MobileControls />}

          {/* Постер под DecisionOverlay, пока Phaser грузится */}
          {posterVisible && (
            <div
              className={`pointer-events-none absolute inset-0 z-10 bg-navy-950 transition-opacity duration-500 ${
                posterFading ? "opacity-0" : "opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={POSTER_SRC}
                alt=""
                className="h-full w-full object-cover opacity-80"
              />
            </div>
          )}

          {showDecision && (
            <DecisionOverlay onChosen={() => setPhase("game")} />
          )}
          {phase === "game" && <ChoiceOverlay />}
        </>
      )}

      {phase === "intro" && (
        <IntroOverlay onDone={() => setPhase("decision")} />
      )}
    </div>
  );
}
