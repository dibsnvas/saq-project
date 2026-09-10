"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { eventBus, type GameEventMap } from "@/game/EventBus";
import { audioManager } from "@/game/audio/AudioManager";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Minimap } from "./Minimap";
import { DebriefPanel } from "./DebriefPanel";
import { useScenarioDefinition, useScenarioPack } from "./ScenarioContext";

const HINT_STORAGE_KEY = "saq.hint.dismissed";

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Минимальный HUD поверх Canvas: цель, таймер, пауза, язык, контекстное
 * действие и короткие уведомления. Всё состояние приходит через EventBus.
 */
export function GameHud({ isTouch }: { isTouch: boolean }) {
  const t = useTranslations();
  // Схема мини-карты — шесть комнат школы; квартира её не показывает.
  const showMinimap = useScenarioPack().minimap !== false;
  const totalMsDefault = useScenarioDefinition().durationSeconds * 1000;

  const [objectiveKey, setObjectiveKey] = useState("game.objective");
  const [remainingMs, setRemainingMs] = useState(totalMsDefault);
  const [paused, setPaused] = useState(false);
  const [completed, setCompleted] = useState<
    GameEventMap["scenario:completed"] | null
  >(null);
  const [interaction, setInteraction] = useState<
    GameEventMap["interaction:available"] | null
  >(null);
  const [toast, setToast] = useState<GameEventMap["scenario:event"] | null>(
    null,
  );
  /** Короткий финальный момент до DebriefPanel */
  const [completionBeatKey, setCompletionBeatKey] = useState<string | null>(
    null,
  );
  const [hintVisible, setHintVisible] = useState(false);
  /** Часы сценария запущены (после первого решения) */
  const [clockStarted, setClockStarted] = useState(false);
  /** true до чтения localStorage — сервер и клиент рендерят одинаково */
  const [soundOn, setSoundOn] = useState(true);
  const toastTimeout = useRef<number | null>(null);
  const completionBeatActive = useRef(false);

  // Сохранённое состояние звука подтягивается только на клиенте.
  useEffect(() => {
    setSoundOn(audioManager.isEnabled());
  }, []);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    audioManager.setEnabled(next);
    if (next) {
      // Клик — пользовательский жест: включение звука сразу активирует контекст.
      void audioManager.unlock();
    }
    eventBus.emit("audio:toggled", { enabled: next });
  };

  // Подписки на игровые события
  useEffect(() => {
    const unsubscribes = [
      eventBus.on("objective:changed", ({ objectiveKey: key }) =>
        setObjectiveKey(key),
      ),
      eventBus.on("timer:changed", ({ remainingMs: ms }) => setRemainingMs(ms)),
      eventBus.on("interaction:available", (payload) =>
        setInteraction(payload),
      ),
      eventBus.on("interaction:cleared", () => setInteraction(null)),
      eventBus.on("scenario:event", (payload) => {
        if (!payload.messageKey) return;
        // Во время финального beat не перекрываем главный текст тостами.
        if (completionBeatActive.current) return;
        setToast(payload);
        if (toastTimeout.current !== null) {
          window.clearTimeout(toastTimeout.current);
        }
        toastTimeout.current = window.setTimeout(() => setToast(null), 4500);
      }),
      eventBus.on("scenario:completion_beat", ({ messageKey }) => {
        completionBeatActive.current = true;
        setToast(null);
        setCompletionBeatKey(messageKey);
        setInteraction(null);
      }),
      eventBus.on("scenario:completed", (payload) => {
        completionBeatActive.current = false;
        setCompletionBeatKey(null);
        setCompleted(payload);
        setInteraction(null);
      }),
      eventBus.on("game:pause", () => setPaused(true)),
      eventBus.on("game:resume", () => setPaused(false)),
      eventBus.on("scenario:started", () => setClockStarted(true)),
    ];
    return () => {
      unsubscribes.forEach((off) => off());
      if (toastTimeout.current !== null) {
        window.clearTimeout(toastTimeout.current);
      }
    };
  }, []);

  // Escape в паузе → продолжить (у приостановленной Phaser-сцены клавиатура молчит)
  useEffect(() => {
    if (!paused) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") eventBus.emit("game:resume");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [paused]);

  // Исчезающая подсказка управления — только при первом запуске на desktop
  useEffect(() => {
    if (isTouch) return;
    try {
      if (window.localStorage.getItem(HINT_STORAGE_KEY)) return;
      window.localStorage.setItem(HINT_STORAGE_KEY, "1");
    } catch {
      // приватный режим — просто показываем подсказку
    }
    setHintVisible(true);
    const timeout = window.setTimeout(() => setHintVisible(false), 6000);
    return () => window.clearTimeout(timeout);
  }, [isTouch]);

  const restart = () => {
    completionBeatActive.current = false;
    setCompleted(null);
    setCompletionBeatKey(null);
    setToast(null);
    setPaused(false);
    setInteraction(null);
    setRemainingMs(totalMsDefault);
    setClockStarted(false);
    eventBus.emit("game:restart");
  };

  const timeLow = remainingMs <= 30_000;

  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      {/* Верхняя панель */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-3 rounded-lg bg-navy-900/85 px-3 py-2 backdrop-blur-sm">
          <span className="hidden text-xs font-bold text-white/60 sm:block">
            {t("game.title")}
          </span>
          <span className="truncate text-sm font-medium">
            {t(objectiveKey)}
          </span>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <span
            className={`rounded-lg px-3 py-2 font-mono text-sm font-bold tabular-nums backdrop-blur-sm transition-opacity ${
              timeLow && clockStarted
                ? "bg-danger/85 text-white"
                : "bg-navy-900/85"
            } ${clockStarted ? "opacity-100" : "opacity-55"}`}
          >
            {formatTime(remainingMs)}
          </span>
          <button
            type="button"
            onClick={toggleSound}
            aria-label={soundOn ? t("hud.soundOn") : t("hud.soundOff")}
            title={soundOn ? t("hud.soundOn") : t("hud.soundOff")}
            className="rounded-lg bg-navy-900/85 px-3 py-2 text-sm backdrop-blur-sm hover:bg-navy-800"
          >
            {soundOn ? "🔊" : "🔇"}
          </button>
          {!completed && (
            <button
              type="button"
              onClick={() =>
                eventBus.emit(paused ? "game:resume" : "game:pause")
              }
              aria-label={t("hud.pause")}
              className="rounded-lg bg-navy-900/85 px-3 py-2 text-sm backdrop-blur-sm hover:bg-navy-800"
            >
              {paused ? "▶" : "⏸"}
            </button>
          )}
          <LanguageSwitcher />
        </div>
      </div>

      {/* Мини-карта */}
      <div className="absolute right-3 top-14 sm:right-4">
        {showMinimap && <Minimap />}
      </div>

      {/* Уведомление о событии сценария */}
      {toast?.messageKey && !completionBeatKey && (
        <div className="absolute inset-x-0 top-16 flex justify-center px-4">
          <p
            className={`rounded-lg px-4 py-2 text-sm font-medium shadow-lg backdrop-blur-sm ${
              toast.severity === "info"
                ? "bg-navy-800/90"
                : "bg-danger/90 text-white"
            }`}
          >
            {t(toast.messageKey)}
          </p>
        </div>
      )}

      {/* Финальный момент после доклада — до дебрифа */}
      {completionBeatKey && !completed && (
        <div className="absolute inset-0 flex items-end justify-center bg-navy-950/25 px-4 pb-16 pt-24 backdrop-blur-[1px]">
          <p className="max-w-lg rounded-xl bg-navy-900/92 px-6 py-4 text-center text-base font-medium leading-snug shadow-xl backdrop-blur-sm sm:text-lg">
            {t(completionBeatKey)}
          </p>
        </div>
      )}

      {/* Первая подсказка управления (desktop, исчезает сама) */}
      {hintVisible && !completed && (
        <div className="absolute inset-x-0 bottom-20 flex justify-center px-4">
          <p className="rounded-lg bg-navy-900/80 px-4 py-2 text-xs text-white/70 backdrop-blur-sm">
            {t("game.hint.controls")}
          </p>
        </div>
      )}

      {/* Контекстное действие (desktop; на телефоне — кнопка MobileControls) */}
      {!isTouch && interaction && !completed && !paused && (
        <div className="absolute inset-x-0 bottom-8 flex justify-center">
          <p className="flex items-center gap-2 rounded-lg bg-navy-900/90 px-4 py-2.5 text-sm font-medium shadow-lg backdrop-blur-sm">
            <kbd className="rounded bg-white/90 px-2 py-0.5 font-mono text-xs font-bold text-navy-900">
              E
            </kbd>
            {t(interaction.labelKey)}
          </p>
        </div>
      )}

      {/* Пауза */}
      {paused && !completed && (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-navy-950/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-5 rounded-xl bg-navy-900 px-10 py-8 shadow-2xl">
            <p className="text-xl font-bold">{t("game.paused")}</p>
            <button
              type="button"
              onClick={() => eventBus.emit("game:resume")}
              className="rounded-lg bg-safe px-6 py-2.5 text-sm font-semibold text-white hover:brightness-110"
            >
              {t("hud.resume")}
            </button>
          </div>
        </div>
      )}

      {/* Завершение сценария: образовательный дебриф */}
      {completed && <DebriefPanel payload={completed} onRestart={restart} />}
    </div>
  );
}
