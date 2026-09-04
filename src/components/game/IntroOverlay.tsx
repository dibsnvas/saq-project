"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Link } from "@/i18n/navigation";
import { audioManager } from "@/game/audio/AudioManager";
import { introVideoSrc } from "@/game/introVideo";

const INTRO_SEEN_KEY = "saq.introSeen";

const POSTER_SRC = "/assets/backgrounds/classroom_students_poster.jpg";

/** Короткий fade перед DecisionOverlay (часть бюджета ≤800ms). */
const FADE_MS = 280;

type FinishReason = "ended" | "skipped" | "error" | "fallback";

/**
 * Вступление: старт → видео → решение.
 * Один <video> живёт с монтирования (preload). По клику «Начать»
 * play() вызывается в том же user-gesture — браузер разрешает автозапуск.
 *
 * finishIntro идемпотентен: ended + skip + failTimer не вызывают onDone дважды.
 */
export function IntroOverlay({ onDone }: { onDone: () => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const videoSrc = introVideoSrc(locale);
  const videoRef = useRef<HTMLVideoElement>(null);
  const finishedRef = useRef(false);
  const failTimerRef = useRef<number | null>(null);
  const skipTimerRef = useRef<number | null>(null);
  const leaveTimerRef = useRef<number | null>(null);

  const [stage, setStage] = useState<"start" | "video" | "error">("start");
  const [muted, setMuted] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [canSkip, setCanSkip] = useState(false);
  const [readyHint, setReadyHint] = useState(false);

  const clearIntroTimers = useCallback(() => {
    if (failTimerRef.current !== null) {
      window.clearTimeout(failTimerRef.current);
      failTimerRef.current = null;
    }
    if (skipTimerRef.current !== null) {
      window.clearTimeout(skipTimerRef.current);
      skipTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    setMuted(!audioManager.isEnabled());
    const video = videoRef.current;
    if (!video) return;

    const onReady = () => setReadyHint(true);
    video.addEventListener("canplaythrough", onReady);
    video.addEventListener("loadeddata", onReady);
    try {
      video.load();
    } catch {
      /* ignore */
    }
    return () => {
      video.removeEventListener("canplaythrough", onReady);
      video.removeEventListener("loadeddata", onReady);
    };
  }, []);

  useEffect(() => {
    if (stage !== "video") return;
    const video = videoRef.current;

    skipTimerRef.current = window.setTimeout(() => setCanSkip(true), 4000);
    failTimerRef.current = window.setTimeout(() => {
      if (finishedRef.current) return;
      if (video && video.readyState < 2 && video.paused) setStage("error");
    }, 20000);

    const onPlaying = () => {
      setBuffering(false);
      setCanSkip(true);
    };
    const onWaiting = () => setBuffering(true);

    video?.addEventListener("playing", onPlaying);
    video?.addEventListener("waiting", onWaiting);
    return () => {
      clearIntroTimers();
      video?.removeEventListener("playing", onPlaying);
      video?.removeEventListener("waiting", onWaiting);
    };
  }, [stage, clearIntroTimers]);

  useEffect(() => {
    return () => {
      clearIntroTimers();
      if (leaveTimerRef.current !== null) {
        window.clearTimeout(leaveTimerRef.current);
      }
    };
  }, [clearIntroTimers]);

  const finishIntro = useCallback(
    (reason: FinishReason) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      clearIntroTimers();

      const video = videoRef.current;
      if (video) {
        video.pause();
        try {
          video.currentTime = 0;
        } catch {
          /* ignore seek errors on broken media */
        }
      }

      if (reason === "ended" || reason === "skipped") {
        try {
          window.localStorage.setItem(INTRO_SEEN_KEY, "1");
        } catch {
          /* приватный режим */
        }
      }

      if (process.env.NODE_ENV === "development") {
        (
          window as unknown as { __saqIntroEndedAt?: number }
        ).__saqIntroEndedAt = performance.now();
      }

      setLeaving(true);
      leaveTimerRef.current = window.setTimeout(onDone, FADE_MS);
    },
    [clearIntroTimers, onDone],
  );

  const startPressed = () => {
    void audioManager.unlock();

    const video = videoRef.current;
    if (!video) {
      setStage("error");
      return;
    }

    setBuffering(true);
    setCanSkip(false);
    setStage("video");

    video.muted = !audioManager.isEnabled();
    setMuted(video.muted);

    void video.play().catch(() => {
      video.muted = true;
      setMuted(true);
      void video.play().catch(() => setStage("error"));
    });
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };

  return (
    <div
      className={`absolute inset-0 z-30 bg-navy-950 transition-opacity duration-300 ${
        leaving ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <video
        ref={videoRef}
        src={videoSrc}
        poster={POSTER_SRC}
        playsInline
        preload="auto"
        muted={muted}
        className={
          stage === "video"
            ? "absolute inset-0 h-full w-full bg-black object-contain"
            : "pointer-events-none absolute h-0 w-0 opacity-0"
        }
        onEnded={() => finishIntro("ended")}
        onError={() => {
          if (!finishedRef.current) setStage("error");
        }}
        aria-hidden={stage !== "video"}
      />

      {stage === "video" && (
        <>
          {buffering && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-navy-950/55">
              <div
                className="h-9 w-9 animate-spin rounded-full border-2 border-white/25 border-t-white"
                aria-hidden
              />
              <p className="text-sm text-white/80">{t("intro.loadingVideo")}</p>
            </div>
          )}

          <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? t("intro.unmute") : t("intro.mute")}
              className="rounded-lg bg-navy-900/80 px-3 py-2 text-sm backdrop-blur-sm hover:bg-navy-800"
            >
              {muted ? "🔇" : "🔊"}
            </button>
            {canSkip && (
              <button
                type="button"
                onClick={() => finishIntro("skipped")}
                className="rounded-lg bg-navy-900/80 px-4 py-2 text-sm font-medium backdrop-blur-sm hover:bg-navy-800"
              >
                {t("intro.skip")} ≫
              </button>
            )}
          </div>
        </>
      )}

      {stage !== "video" && (
        <div className="relative h-full w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={POSTER_SRC}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/55 to-navy-950/30" />

          <div className="absolute right-4 top-4">
            <LanguageSwitcher />
          </div>

          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 px-6 pb-8 text-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-white/50">
                {t("home.scenarioLabel")} · {t("scenario.fireSchool.name")}
              </p>
              <h1 className="mt-1 text-3xl font-bold sm:text-4xl">
                {t("game.title")}
              </h1>
            </div>

            {stage === "error" && (
              <p className="rounded-lg bg-navy-900/85 px-4 py-2 text-sm text-white/70">
                {t("intro.videoUnavailable")}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3">
              {stage === "error" ? (
                <button
                  type="button"
                  onClick={() => finishIntro("fallback")}
                  className="rounded-lg bg-safe px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-safe/20 hover:brightness-110"
                >
                  {t("intro.continue")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startPressed}
                  className="rounded-lg bg-safe px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-safe/20 hover:brightness-110"
                >
                  {t("home.play")}
                </button>
              )}
            </div>

            {readyHint && stage !== "error" && (
              <p className="text-xs text-white/35">{t("intro.videoReady")}</p>
            )}

            <p className="max-w-xl text-xs leading-relaxed text-white/40">
              {t("intro.disclaimer")}
            </p>
            <Link
              href="/teacher"
              className="text-[11px] text-white/35 underline-offset-2 hover:text-white/55 hover:underline"
            >
              {t("home.teacherDemoLink")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
