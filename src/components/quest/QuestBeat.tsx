"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

/**
 * Кадр хронологии: последствие выбора («камера уходит под стол») или
 * переход в следующую комнату («вы выбираетесь из-под парты и выходите»).
 *
 * Если у такта есть видеоклип — играет он, а картинка служит постером и
 * запасным вариантом (медленная сеть, ошибка загрузки, режим уменьшенной
 * анимации). Механики выбора здесь нет.
 */
export function QuestBeat({
  image,
  video,
  text,
  kind,
  voice,
  onEnded,
}: {
  image: string;
  video?: string;
  text?: string;
  kind: "intro" | "outcome" | "bridge";
  /** база пути к реплике; файл берётся по локали: <voice>.<locale>.mp3 */
  voice?: string;
  /** клип доиграл (или не может играть) — такт передаёт ход дальше */
  onEnded?: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [voiceFailed, setVoiceFailed] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  }, []);

  const showVideo = Boolean(video) && !videoFailed && !reducedMotion;

  // Клип не играет (нет кодека, отключена анимация) — вступление
  // пропускается целиком, игрок сразу видит вопрос.
  useEffect(() => {
    if (kind === "intro" && !showVideo) onEnded?.();
  }, [kind, showVideo, onEnded]);

  // Клип стартует сам. Если браузер запретил звук — играем без него и
  // предлагаем включить кнопкой, кадр при этом не теряется.
  useEffect(() => {
    if (!showVideo) return;
    const el = videoRef.current;
    if (!el) return;
    el.muted = false;
    el.play().catch(() => {
      el.muted = true;
      setVideoMuted(true);
      el.play().catch(() => setVideoFailed(true));
    });
  }, [showVideo, video]);

  // Реплика звучит один раз при появлении кадра. Субтитр виден всегда.
  useEffect(() => {
    if (!voice) return;
    const audio = new Audio(`${voice}.${locale}.mp3`);
    audio.volume = 0.9;
    audioRef.current = audio;
    audio.play().catch(() => setVoiceFailed(true));
    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, [voice, locale]);

  const replayVoice = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch(() => setVoiceFailed(true));
  };

  const unmuteVideo = () => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = false;
    setVideoMuted(false);
    void el.play().catch(() => setVideoMuted(true));
  };

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {showVideo ? (
        <video
          ref={videoRef}
          src={video}
          poster={image}
          playsInline
          preload="auto"
          onError={() => setVideoFailed(true)}
          onEnded={onEnded}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div
          className={`absolute inset-0 bg-cover bg-center ${
            kind === "outcome" ? "quest-camera-in" : "quest-camera-drift"
          }`}
          style={{
            backgroundImage: `url(${image})`,
            filter: "brightness(1.12) saturate(1.05)",
          }}
        />
      )}

      {kind !== "intro" && (
        <div
          className={`pointer-events-none absolute inset-0 ${
            kind === "outcome" || showVideo
              ? "bg-gradient-to-b from-navy-950/20 via-navy-950/0 to-navy-950/85"
              : "bg-navy-950/55"
          }`}
        />
      )}

      {/* Титр перехода — по центру кадра. Текст последствия рисует HUD:
          иначе он уходит под карточку разбора. */}
      {kind === "bridge" && text && (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-8">
          <p className="max-w-xl text-center text-lg font-semibold leading-relaxed text-white drop-shadow sm:text-2xl">
            {text}
          </p>
        </div>
      )}

      {/* Управление звуком — под шапкой, подальше от нижнего слоя */}
      {(voice || (showVideo && videoMuted)) && (
        <div className="absolute right-4 top-24 z-30 flex flex-col items-end gap-2 sm:right-6">
          {voice && (
            <BeatButton onClick={replayVoice}>
              {voiceFailed ? t("quest.playVoice") : t("quest.replayVoice")}
            </BeatButton>
          )}
          {showVideo && videoMuted && (
            <BeatButton onClick={unmuteVideo}>{t("quest.enableSound")}</BeatButton>
          )}
        </div>
      )}
    </div>
  );
}

function BeatButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-white/25 bg-navy-950/70 px-2.5 py-1 text-[11px] font-semibold text-white/80 transition hover:bg-navy-800"
    >
      {children}
    </button>
  );
}
