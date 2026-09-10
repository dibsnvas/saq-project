"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useScenarioPack } from "./ScenarioContext";
import type { GameEventMap } from "@/game/EventBus";
import type { ScenarioOutcome, SkillLevel } from "@/game/scenario/branching";

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const LEVEL_STYLE: Record<SkillLevel, string> = {
  strong: "bg-safe/15 text-safe",
  developing: "bg-white/10 text-white/70",
  needs_review: "bg-danger/15 text-danger",
};

const OUTCOME_TITLE_KEY: Record<ScenarioOutcome, string> = {
  safe_independent: "debrief.outcomeTitle.safeIndependent",
  safe_with_guidance: "debrief.outcomeTitle.safeGuidance",
  safe_with_risks: "debrief.outcomeTitle.safeRisks",
  incomplete: "debrief.outcomeTitle.incomplete",
};

const OUTCOME_COLOR: Record<ScenarioOutcome, string> = {
  safe_independent: "text-safe",
  safe_with_guidance: "text-white",
  safe_with_risks: "text-white",
  incomplete: "text-danger",
};

/** Не перегружаем экран: только самые важные образовательные моменты. */
const MAX_GOOD_ACTIONS = 4;
const MAX_RISKY_ACTIONS = 3;

/**
 * Образовательный дебриф: итог, три оси (реакция / маршрут / завершение),
 * правильные и опасные действия, «правило на следующий раз» и хронология.
 * Всё содержимое приходит из ScenarioEvaluator (data-driven rules.json).
 */
export function DebriefPanel({
  payload,
  onRestart,
}: {
  payload: GameEventMap["scenario:completed"];
  onRestart: () => void;
}) {
  const t = useTranslations();
  const { next } = useScenarioPack();
  const { report } = payload;
  const { profile } = report;

  const skills = [
    { key: "safety", labelKey: "debrief.skill.safety" },
    { key: "awareness", labelKey: "debrief.skill.awareness" },
    { key: "completion", labelKey: "debrief.skill.completion" },
  ] as const;

  const goodActions = report.goodActions.slice(0, MAX_GOOD_ACTIONS);
  const riskyActions = report.riskyActions.slice(0, MAX_RISKY_ACTIONS);

  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center overflow-hidden p-3">
      <div className="max-h-[92dvh] w-[min(94vw,600px)] overflow-y-auto rounded-2xl border border-white/10 bg-navy-900/97 p-5 shadow-2xl backdrop-blur-md sm:p-6">
        {/* Итог: тип прохождения + короткое объяснение */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              className={`text-xl font-bold sm:text-2xl ${OUTCOME_COLOR[profile.outcome]}`}
            >
              {t(OUTCOME_TITLE_KEY[profile.outcome])}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-white/75">
              {t(profile.explanationKey)}
            </p>
            <p className="mt-1.5 text-sm text-white/60">
              {t("hud.timeUsed")}:{" "}
              <span className="font-mono font-bold text-white">
                {formatTime(report.timeMs)}
              </span>
              {report.firstDecision && (
                <>
                  {" · "}
                  {t("debrief.firstDecision")}:{" "}
                  <span className="text-white">
                    {t(`debrief.decisionLabel.${report.firstDecision}`)}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Три навыка: безопасность / осознанность / завершение */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {skills.map(({ key, labelKey }) => (
            <div
              key={key}
              className={`rounded-lg px-2 py-2 text-center ${LEVEL_STYLE[profile[key]]}`}
            >
              <p className="text-[11px] uppercase tracking-wide opacity-75">
                {t(labelKey)}
              </p>
              <p className="mt-0.5 text-sm font-bold">
                {t(`debrief.skillLevel.${profile[key]}`)}
              </p>
            </div>
          ))}
        </div>

        {/* Действия: приоритетные, не все подряд */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {goodActions.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-safe">
                {t("debrief.goodTitle")}
              </p>
              <ul className="mt-1.5 space-y-1">
                {goodActions.map((key) => (
                  <li key={key} className="flex gap-2 text-sm text-white/85">
                    <span className="text-safe">✓</span>
                    {t(key)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {riskyActions.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-danger">
                {t("debrief.riskTitle")}
              </p>
              <ul className="mt-1.5 space-y-1">
                {riskyActions.map((key) => (
                  <li key={key} className="flex gap-2 text-sm text-white/85">
                    <span className="text-danger">!</span>
                    {t(key)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Исправленные ошибки: остаются в истории, но отмечены отдельно */}
        {profile.correctedMistakes.length > 0 && (
          <div className="mt-4 rounded-xl border border-white/15 bg-white/5 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
              {t("debrief.correctionsTitle")}
            </p>
            <ul className="mt-1.5 space-y-1">
              {profile.correctedMistakes.map((key) => (
                <li key={key} className="flex gap-2 text-sm text-white/85">
                  <span className="text-safe">↺</span>
                  {t(key)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Companion: итог помощи однокласснице */}
        {profile.companion !== "not_helped" && (
          <p className="mt-3 text-sm text-white/75">
            {profile.companion === "help_attempt_risky" ? "⚠ " : "✓ "}
            {t(`debrief.companionOutcome.${profile.companion}`)}
          </p>
        )}

        {/* Правило на следующий раз */}
        <div className="mt-4 rounded-xl border border-safe/25 bg-safe/10 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-safe">
            {t("debrief.lessonTitle")}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-white/90">
            {t(report.lessonKey)}
          </p>
        </div>

        {/* Хронология */}
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
            {t("debrief.timelineTitle")}
          </p>
          <ol className="mt-2 space-y-1 border-l border-white/15 pl-3">
            {report.timeline.map((entry, i) => (
              <li
                key={`${entry.id}-${i}`}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <span className="text-white/80">{t(entry.labelKey)}</span>
                <span className="font-mono text-xs tabular-nums text-white/45">
                  {formatTime(entry.t)}
                </span>
              </li>
            ))}
          </ol>
        </div>

        {/* Мотивация к повтору + кнопки */}
        <p className="mt-4 text-center text-sm italic text-white/55">
          {t("debrief.replayQuestion")}
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2.5">
          {/* Следующая локация того же сценария — главное действие после разбора. */}
          {next && (
            <Link
              href={next.href}
              className="rounded-lg bg-safe px-6 py-2.5 text-sm font-semibold text-white hover:brightness-110"
            >
              {t(next.labelKey)} →
            </Link>
          )}
          <button
            type="button"
            onClick={onRestart}
            className={
              next
                ? "rounded-lg border border-white/20 bg-navy-800/80 px-6 py-2.5 text-sm text-white/85 hover:bg-navy-700"
                : "rounded-lg bg-safe px-6 py-2.5 text-sm font-semibold text-white hover:brightness-110"
            }
          >
            {t("hud.playAgain")}
          </button>
          <Link
            href="/"
            className="rounded-lg border border-white/20 bg-navy-800/80 px-6 py-2.5 text-sm text-white/85 hover:bg-navy-700"
          >
            {t("debrief.home")}
          </Link>
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-white/35">
          {t("intro.disclaimer")}
        </p>
      </div>
    </div>
  );
}
