"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import questRaw from "@/content/earthquake/quest.json";
import { correctOptionOf, parseQuest, type QuestOption } from "@/quest/schema";
import {
  summarizeQuest,
  TIMEOUT_OPTION_ID,
  type QuestAnswer,
  type QuestGrade,
} from "@/quest/scoring";
import { LocalStorageTelemetryRepository } from "@/game/systems/TelemetryRepository";
import { QuestBeat } from "./QuestBeat";
import { QuestScene, type SceneOutcome } from "./QuestScene";
import { RoomIcon } from "./RoomIcon";

/**
 * Квест «Землетрясение: правильная реакция»: 10 комнат по схеме
 * ситуация → событие → вопрос → выбор → разбор → следующая комната.
 * Решение принимается нажатием на место в кадре (QuestScene); комната без
 * фона откатывается на две кнопки с текстом. Данные — quest.json,
 * тексты — локали, подсчёт итога — quest/scoring.ts.
 */

// Валидируем данные на входе: битый quest.json падает громко и сразу.
const QUEST = parseQuest(questRaw);
const TICK_MS = 100;
/** Сейчас студийные MP3 сцен записаны только для русской локали. */
const RECORDED_NARRATION_LOCALES = new Set(["ru"]);

const GRADE_STYLE: Record<QuestGrade, string> = {
  strong: "text-safe",
  developing: "text-white",
  needs_review: "text-danger",
};

type Phase = "room" | "result";
/**
 * Такт внутри комнаты: вход в комнату → вопрос → последствие → переход.
 * Вступительный клип есть не у всех комнат, поэтому такт стартовый вычисляется.
 */
type Beat = "intro" | "scene" | "outcome" | "bridge";
type NarrationStatus = "loading" | "playing" | "blocked" | "done";

const telemetry = new LocalStorageTelemetryRepository();

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function QuestClient() {
  const t = useTranslations();
  const [phase, setPhase] = useState<Phase>("room");
  const [index, setIndex] = useState(0);
  const [outcome, setOutcome] = useState<SceneOutcome | null>(null);
  const [beat, setBeat] = useState<Beat>(
    QUEST.rooms[0].intro ? "intro" : "scene",
  );
  const [secondsLeft, setSecondsLeft] = useState(QUEST.decisionSeconds);
  const [answers, setAnswers] = useState<QuestAnswer[]>([]);
  const [durationMs, setDurationMs] = useState(0);
  const startedAt = useRef(0);

  const locale = useLocale();
  const narrationRef = useRef<HTMLAudioElement | null>(null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  /** Статус привязан к комнате, чтобы новая сцена ни на один кадр не получила
   *  активный таймер от предыдущей. */
  const [narration, setNarration] = useState<{
    roomId: string;
    status: NarrationStatus;
  }>({ roomId: "", status: "loading" });

  // Квест начинается сразу при открытии страницы: засекаем время здесь,
  // а не по кнопке заставки.
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const room = QUEST.rooms[index];
  const isLast = index === QUEST.rooms.length - 1;
  const narrationStatus: NarrationStatus = !room.voice
    ? "done"
    : narration.roomId === room.id
      ? narration.status
      : "loading";
  const narrationDone = narrationStatus === "done";
  const narrationFailed = narrationStatus === "blocked";
  const questionText = t(room.questionKey);
  const summary = useMemo(() => summarizeQuest(QUEST, answers), [answers]);
  const correctOption = useMemo(() => correctOptionOf(room), [room]);

  const toggleFullscreen = useCallback(() => {
    const root = document.documentElement;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
      return;
    }
    void root.requestFullscreen?.().catch(() => {
      /* браузер запретил полноэкранный режим — раскладка и так во весь экран */
    });
  }, []);

  const start = useCallback(() => {
    startedAt.current = Date.now();
    setPhase("room");
    setIndex(0);
    setOutcome(null);
    setBeat(QUEST.rooms[0].intro ? "intro" : "scene");
    setSecondsLeft(QUEST.decisionSeconds);
    setAnswers([]);
  }, []);

  // Сначала звучит реплика сцены с вопросом, и только затем открываются выбор
  // и таймер. При запрете autoplay ждём явного клика, не съедая время игрока.
  useEffect(() => {
    if (phase !== "room" || beat !== "scene" || !room.voice) return;

    let active = true;
    setNarration({ roomId: room.id, status: "loading" });

    // Не запрашиваем отсутствующий <room>.kk.mp3. Для этой локали кнопка
    // запускает системный синтез речи с локализованным текстом вопроса.
    if (!RECORDED_NARRATION_LOCALES.has(locale)) {
      setNarration({ roomId: room.id, status: "blocked" });
      return () => {
        active = false;
        if (speechRef.current) {
          window.speechSynthesis.cancel();
          speechRef.current = null;
        }
      };
    }

    const audio = new Audio(`${room.voice}.${locale}.mp3`);
    audio.volume = 0.95;
    audio.preload = "auto";
    narrationRef.current = audio;

    const setStatus = (status: NarrationStatus) => {
      if (active) setNarration({ roomId: room.id, status });
    };
    const finish = () => setStatus("done");
    const fail = () => setStatus("blocked");
    audio.addEventListener("ended", finish);
    audio.addEventListener("error", fail);
    setStatus("playing");
    void audio.play().catch(fail);

    return () => {
      active = false;
      audio.removeEventListener("ended", finish);
      audio.removeEventListener("error", fail);
      audio.pause();
      if (narrationRef.current === audio) narrationRef.current = null;
    };
  }, [phase, beat, room.id, room.voice, locale]);

  const replayNarration = useCallback(() => {
    if (!RECORDED_NARRATION_LOCALES.has(locale)) {
      if (
        !("speechSynthesis" in window) ||
        typeof SpeechSynthesisUtterance === "undefined"
      ) {
        setNarration({ roomId: room.id, status: "blocked" });
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(questionText);
      utterance.lang = locale === "kk" ? "kk-KZ" : locale;
      utterance.rate = 0.95;
      utterance.onend = () => {
        if (speechRef.current !== utterance) return;
        speechRef.current = null;
        setNarration({ roomId: room.id, status: "done" });
      };
      utterance.onerror = () => {
        if (speechRef.current !== utterance) return;
        speechRef.current = null;
        setNarration({ roomId: room.id, status: "blocked" });
      };
      speechRef.current = utterance;
      setNarration({ roomId: room.id, status: "playing" });
      window.speechSynthesis.speak(utterance);
      return;
    }

    const existing = narrationRef.current;
    if (existing) {
      existing.currentTime = 0;
      setNarration({ roomId: room.id, status: "playing" });
      void existing.play().catch(() =>
        setNarration({ roomId: room.id, status: "blocked" }),
      );
      return;
    }
    if (!room.voice) return;
    // Первый запуск заблокировал браузер: клик — это жест пользователя.
    const audio = new Audio(`${room.voice}.${locale}.mp3`);
    audio.volume = 0.95;
    narrationRef.current = audio;
    const finish = () =>
      setNarration({ roomId: room.id, status: "done" });
    const fail = () =>
      setNarration({ roomId: room.id, status: "blocked" });
    audio.addEventListener("ended", finish, { once: true });
    audio.addEventListener("error", fail, { once: true });
    setNarration({ roomId: room.id, status: "playing" });
    void audio.play().then(
      () => undefined,
      fail,
    );
  }, [room.id, room.voice, locale, questionText]);

  const startWithoutNarration = useCallback(() => {
    narrationRef.current?.pause();
    if (speechRef.current) {
      window.speechSynthesis.cancel();
      speechRef.current = null;
    }
    setNarration({ roomId: room.id, status: "done" });
  }, [room.id]);

  const answer = useCallback(
    (option: QuestOption | null) => {
      // Повторный клик не переписывает уже показанный разбор.
      if (outcome) return;
      setOutcome({ option });
      if (room.outcomes) setBeat("outcome");
      setAnswers((prev) => [
        ...prev,
        {
          roomId: room.id,
          optionId: option?.id ?? TIMEOUT_OPTION_ID,
          correct: option?.correct ?? false,
          t: Date.now() - startedAt.current,
        },
      ]);
    },
    [outcome, room.id, room.outcomes],
  );

  const next = useCallback(() => {
    if (!outcome) return;
    // Из последствия — в переход (если он есть), и только потом в комнату.
    if (beat === "outcome" && room.bridge) {
      setBeat("bridge");
      return;
    }
    if (!isLast) {
      const upcoming = QUEST.rooms[index + 1];
      setIndex((i) => i + 1);
      setOutcome(null);
      setBeat(upcoming.intro ? "intro" : "scene");
      setSecondsLeft(QUEST.decisionSeconds);
      return;
    }
    setDurationMs(Date.now() - startedAt.current);
    setPhase("result");
  }, [outcome, beat, room.bridge, isLast, index]);

  // Часы на решение: тикают только пока комната открыта и ответа нет.
  useEffect(() => {
    if (phase !== "room" || outcome || beat !== "scene" || !narrationDone)
      return;
    const timer = window.setInterval(() => {
      setSecondsLeft((left) => {
        const next = left - TICK_MS / 1000;
        if (next > 0) return next;
        window.clearInterval(timer);
        return 0;
      });
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [phase, outcome, beat, index, narrationDone]);

  // Время вышло — комната закрывается как ошибка, показывается верный ответ.
  useEffect(() => {
    if (phase === "room" && beat === "scene" && !outcome && secondsLeft <= 0) {
      answer(null);
    }
  }, [phase, beat, outcome, secondsLeft, answer]);

  // Фон следующей комнаты грузится заранее — переход без белой вспышки.
  useEffect(() => {
    if (phase !== "room") return;
    const upcoming = [
      ...Object.values(QUEST.rooms[index].outcomes ?? {}).map((o) => o.image),
      QUEST.rooms[index].bridge?.image,
      QUEST.rooms[index + 1]?.background,
      QUEST.rooms[index + 1]?.intro?.video,
    ].filter(Boolean) as string[];
    for (const src of upcoming) {
      const img = new window.Image();
      img.src = src;
    }
  }, [phase, index]);

  // Итог прохождения — в то же локальное хранилище, что и игра.
  // Персональные данные не сохраняются (см. TelemetryRepository).
  useEffect(() => {
    if (phase !== "result") return;
    telemetry.save({
      scenarioId: QUEST.id,
      completed: true,
      durationMs,
      recordedAt: new Date().toISOString(),
      events: answers.map((a) => ({
        id: `${a.roomId}:${a.optionId}`,
        t: a.t,
        x: 0,
        y: 0,
        meta: { correct: a.correct },
      })),
    });
  }, [phase, answers, durationMs]);

  // Клавиатура: 1/2 — выбор варианта, Enter/пробел — дальше.
  useEffect(() => {
    if (phase !== "room") return;
    const onKey = (e: KeyboardEvent) => {
      if (
        !outcome &&
        beat === "scene" &&
        narrationDone &&
        (e.key === "1" || e.key === "2")
      ) {
        e.preventDefault();
        answer(room.options[Number(e.key) - 1]);
        return;
      }
      if (outcome && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, beat, outcome, answer, next, room, narrationDone]);

  if (phase === "result") {
    return (
      <Shell>
        <div className="rounded-2xl border border-white/10 bg-navy-900/70 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/45">
            {t("quest.result.label")}
          </p>
          <h1
            className={`mt-2 text-2xl font-bold sm:text-3xl ${GRADE_STYLE[summary.grade]}`}
          >
            {t(`quest.result.grade.${summary.grade}.title`)}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            {t(`quest.result.grade.${summary.grade}.text`)}
          </p>

          <div className="mt-5 flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <p className="text-sm text-white/60">
              {t("quest.result.score")}:{" "}
              <span className="font-mono text-lg font-bold text-white">
                {summary.correctCount}/{summary.total}
              </span>
            </p>
            <p className="text-sm text-white/60">
              {t("quest.result.time")}:{" "}
              <span className="font-mono font-bold text-white">
                {formatTime(durationMs)}
              </span>
            </p>
          </div>

          {summary.mistakes.length > 0 ? (
            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-danger">
                {t("quest.result.mistakesTitle")}
              </p>
              <ul className="mt-2 space-y-3">
                {summary.mistakes.map((mistake) => (
                  <li
                    key={mistake.roomId}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <p className="text-sm font-semibold text-white">
                      {t(mistake.roomTitleKey)}
                    </p>
                    <p className="mt-1 flex gap-2 text-sm text-white/85">
                      <span className="text-safe">✓</span>
                      {t(mistake.correctLabelKey)}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-white/60">
                      {t(mistake.explanationKey)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-6 rounded-xl border border-safe/25 bg-safe/10 px-4 py-3 text-sm text-white/90">
              {t("quest.result.perfect")}
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={start}
              className="rounded-lg bg-safe px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
            >
              {t("quest.result.again")}
            </button>
            <Link
              href="/"
              className="rounded-lg border border-white/20 bg-navy-800/80 px-6 py-2.5 text-sm text-white/85 transition hover:bg-navy-700"
            >
              {t("debrief.home")}
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  const timedOut = outcome !== null && outcome.option === null;
  const chosen = outcome?.option ?? null;
  const verdictOk = chosen?.correct === true;
  // Не успел решить — камера всё равно показывает, как надо было поступить.
  const shownOutcome = outcome
    ? room.outcomes?.[chosen?.id ?? correctOption.id]
    : undefined;

  const timeRatio = Math.max(
    0,
    Math.min(1, secondsLeft / QUEST.decisionSeconds),
  );
  const urgent =
    beat === "scene" && narrationDone && !outcome && secondsLeft <= 4;

  return (
    // Полноэкранная раскладка: кадр занимает весь экран, интерфейс лежит
    // поверх него слоем, а не рамкой вокруг.
    <main className="fixed inset-0 overflow-hidden bg-black text-white">
      {beat === "intro" && room.intro && room.background ? (
        <QuestBeat
          key={`intro-${room.id}`}
          image={room.background}
          video={room.intro.video}
          kind="intro"
          onEnded={() => setBeat("scene")}
        />
      ) : beat === "bridge" && room.bridge ? (
        <QuestBeat
          key={`bridge-${room.id}`}
          image={room.bridge.image}
          video={room.bridge.video}
          text={t(room.bridge.textKey)}
          kind="bridge"
        />
      ) : beat === "outcome" && shownOutcome ? (
        <QuestBeat
          key={`outcome-${room.id}-${chosen?.id ?? "timeout"}`}
          image={shownOutcome.image}
          video={shownOutcome.video}
          text={t(shownOutcome.textKey)}
          kind="outcome"
          voice={shownOutcome.voice}
        />
      ) : room.background ? (
        <QuestScene
          room={room}
          outcome={outcome}
          interactionsEnabled={narrationDone}
          onChoose={(option) => answer(option)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <FallbackChoices
            room={room}
            outcome={outcome}
            interactionsEnabled={narrationDone}
            onChoose={answer}
          />
        </div>
      )}

      {/* Верхний слой: прогресс, комната, время на решение */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30">
        <div className="flex gap-1 px-1 pt-1" aria-hidden="true">
          {QUEST.rooms.map((r, i) => (
            <span
              key={r.id}
              className={`h-1 flex-1 rounded-full ${
                i < index
                  ? "bg-safe/70"
                  : i === index
                    ? "bg-white/80"
                    : "bg-white/15"
              }`}
            />
          ))}
        </div>
        <div className="flex items-start justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent px-4 pb-8 pt-3 sm:px-6">
          <div
            className={`flex items-start gap-3 ${beat === "bridge" ? "invisible" : ""}`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-black/40 text-white/80 backdrop-blur-sm">
              <RoomIcon icon={room.icon} className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/55">
                {t("quest.roomProgress", {
                  current: index + 1,
                  total: QUEST.rooms.length,
                })}
              </p>
              <h1 className="text-base font-bold leading-tight drop-shadow sm:text-lg">
                {t(room.titleKey)}
              </h1>
              <p className="mt-0.5 max-w-md text-xs leading-relaxed text-white/70 drop-shadow sm:text-sm">
                {t(room.situationKey)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {beat === "scene" && narrationDone && (
              <span
                className={`rounded-md px-2 py-1 font-mono text-xs font-bold tabular-nums ${
                  urgent ? "bg-danger text-white" : "bg-black/60 text-white/85"
                }`}
              >
                {t("quest.secondsLeft", { seconds: Math.ceil(secondsLeft) })}
              </span>
            )}
            {beat === "scene" && !narrationDone && !narrationFailed && (
              <span className="rounded-md border border-white/20 bg-black/60 px-2.5 py-1 text-xs font-semibold text-white/90 backdrop-blur-sm">
                {t("quest.narrationPlaying")}
              </span>
            )}
            {beat === "scene" && room.voice && narrationDone && (
              <button
                type="button"
                onClick={replayNarration}
                className="pointer-events-auto rounded-md border border-white/20 bg-black/50 px-2.5 py-1 text-[11px] font-semibold text-white/80 backdrop-blur-sm transition hover:bg-black/70"
              >
                {t("quest.replayVoice")}
              </button>
            )}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="pointer-events-auto rounded-md border border-white/20 bg-black/50 px-2.5 py-1 text-[11px] font-semibold text-white/80 backdrop-blur-sm transition hover:bg-black/70"
            >
              {t("quest.fullscreen")}
            </button>
          </div>
        </div>
        {beat === "scene" && narrationDone && (
          <div className="mx-4 h-0.5 overflow-hidden rounded-full bg-white/15 sm:mx-6">
            <div
              className={`h-full transition-[width] duration-100 ease-linear ${
                urgent ? "bg-danger" : "bg-white/80"
              }`}
              style={{ width: `${timeRatio * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Вопрос отделён от нижней панели и поднят над сценой: крупный текст
          хорошо читается, но не закрывает хотспоты в нижней половине кадра. */}
      {beat === "scene" && (
        <div className="quest-question-wrap pointer-events-none absolute inset-x-0 z-30 px-4 sm:px-6">
          <section
            aria-labelledby="quest-question"
            className="quest-question-panel mx-auto max-w-4xl rounded-2xl border border-white/30 bg-navy-950/90 px-4 py-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md sm:px-5 sm:py-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="quest-question-label text-[11px] font-black uppercase tracking-[0.16em] text-white/65">
                {t("quest.questionLabel")}
              </p>
              {!narrationDone && !narrationFailed && (
                <p className="text-xs font-semibold text-white/70">
                  {t("quest.timerAfterNarration")}
                </p>
              )}
            </div>
            <p
              id="quest-question"
              className="quest-question-text mt-1 text-xl font-black leading-tight text-white drop-shadow sm:text-3xl"
            >
              {t(room.questionKey)}
            </p>

            {narrationFailed && (
              <div
                className="pointer-events-auto mt-3 flex flex-wrap items-center gap-2 border-t border-white/15 pt-3"
                role="status"
              >
                <p className="mr-auto text-xs text-white/70 sm:text-sm">
                  {t("quest.voiceBlocked")}
                </p>
                <button
                  type="button"
                  onClick={replayNarration}
                  className="rounded-lg bg-white px-4 py-2 text-xs font-bold text-navy-950 transition hover:bg-white/90 sm:text-sm"
                >
                  {t("quest.playVoice")}
                </button>
                <button
                  type="button"
                  onClick={startWithoutNarration}
                  className="rounded-lg border border-white/25 px-4 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/10 sm:text-sm"
                >
                  {t("quest.startWithoutVoice")}
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Нижний слой: событие, разбор и переход дальше */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-4 pb-4 pt-16 sm:px-6 sm:pb-6">
        <div className="mx-auto w-full max-w-4xl space-y-3">
          {beat === "scene" && (
            <p className="text-sm leading-relaxed text-white/85 drop-shadow sm:text-base">
              {t(room.eventKey)}
            </p>
          )}

          {/* Что произошло в кадре — рассказ от первого лица */}
          {beat === "outcome" && shownOutcome && (
            <p className="text-base font-medium leading-relaxed text-white drop-shadow sm:text-lg">
              {t(shownOutcome.textKey)}
            </p>
          )}

          {/* Разбор: правильно / неправильно / время вышло + объяснение */}
          {outcome && beat !== "bridge" && (
            <div
              aria-live="polite"
              className={`rounded-xl border px-4 py-3 backdrop-blur-sm ${
                verdictOk
                  ? "border-safe/40 bg-safe/15"
                  : "border-danger/40 bg-danger/15"
              }`}
            >
              <p
                className={`text-sm font-bold ${verdictOk ? "text-safe" : "text-danger"}`}
              >
                {timedOut
                  ? t("quest.timeoutTitle")
                  : verdictOk
                    ? t("quest.verdict.correct")
                    : t("quest.verdict.wrong")}
              </p>
              {timedOut ? (
                <>
                  <p className="mt-1 text-sm leading-relaxed text-white/90">
                    {t("quest.timeoutNote")}
                  </p>
                  <p className="mt-1.5 flex gap-2 text-sm leading-relaxed text-white/90">
                    <span className="text-safe">✓</span>
                    {t(correctOption.labelKey)}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm leading-relaxed text-white/90">
                  {t(chosen!.explanationKey)}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-white/45">
              {beat === "intro"
                ? t("quest.introHint")
                : outcome
                  ? t("quest.keyboardHint")
                  : t("quest.sceneHint")}
            </p>
            {beat === "intro" ? (
              <button
                type="button"
                onClick={() => setBeat("scene")}
                className="pointer-events-auto rounded-lg border border-white/25 bg-black/50 px-6 py-2.5 text-sm text-white/90 backdrop-blur-sm transition hover:bg-black/70"
              >
                {t("quest.skipIntro")}
              </button>
            ) : (
              <button
                type="button"
                onClick={next}
                disabled={!outcome}
                className="pointer-events-auto rounded-lg bg-safe px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
              >
                {beat === "outcome" && room.bridge
                  ? t("quest.continue")
                  : isLast
                    ? t("quest.finish")
                    : t("quest.next")}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

/** Комната без фона: те же два варианта, но текстовыми кнопками. */
function FallbackChoices({
  room,
  outcome,
  interactionsEnabled,
  onChoose,
}: {
  room: ReturnType<typeof parseQuest>["rooms"][number];
  outcome: SceneOutcome | null;
  interactionsEnabled: boolean;
  onChoose: (option: QuestOption) => void;
}) {
  const t = useTranslations();
  const reveal = outcome !== null;

  return (
    <div className="rounded-2xl border border-white/10 bg-navy-900/70 p-5">
      <p className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm leading-relaxed text-white/90">
        {t(room.eventKey)}
      </p>
      <p className="mt-4 text-base font-semibold sm:text-lg">
        {t(room.questionKey)}
      </p>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        {room.options.map((option, i) => {
          const isChosen = outcome?.option?.id === option.id;
          const tone = !reveal
            ? "border-white/12 bg-navy-800/70 hover:border-white/30 hover:bg-navy-700"
            : option.correct
              ? "border-safe/50 bg-safe/10"
              : isChosen
                ? "border-danger/50 bg-danger/10"
                : "border-white/10 bg-navy-800/40 opacity-55";

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChoose(option)}
              disabled={reveal || !interactionsEnabled}
              aria-pressed={isChosen}
              className={`rounded-xl border px-4 py-3 text-left text-sm leading-relaxed transition disabled:cursor-default ${tone}`}
            >
              <span className="mr-2 font-mono text-xs text-white/40">
                {i + 1}
              </span>
              {t(option.labelKey)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col bg-navy-950 px-4 py-6 sm:py-8">
      <div className="m-auto w-full max-w-3xl">{children}</div>
    </main>
  );
}
