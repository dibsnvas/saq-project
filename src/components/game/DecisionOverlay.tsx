"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { eventBus } from "@/game/EventBus";
import { useScenarioDefinition } from "./ScenarioContext";

/**
 * Первое интерактивное решение после сигнала тревоги. Варианты и события —
 * data-driven из scenario.json (introDecision); текстов в коде нет.
 * Таймер сценария стартует только после выбора (в SchoolScene).
 */
export function DecisionOverlay({ onChosen }: { onChosen: () => void }) {
  const t = useTranslations();
  const [chosen, setChosen] = useState(false);
  const { introDecision } = useScenarioDefinition();

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const w = window as unknown as {
      __saqIntroEndedAt?: number;
      __saqDecisionVisibleAt?: number;
    };
    w.__saqDecisionVisibleAt = performance.now();
    if (typeof w.__saqIntroEndedAt === "number") {
      // Dev-only latency probe: intro ended → decision visible.
      console.info(
        `[saq] intro→decision ${Math.round(w.__saqDecisionVisibleAt - w.__saqIntroEndedAt)}ms`,
      );
    }
  }, []);

  const choose = (optionId: string) => {
    if (chosen) return;
    setChosen(true);
    eventBus.emit("decision:choose", { optionId });
    onChosen();
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-end justify-center bg-navy-950/35 pb-8 sm:items-center sm:pb-0">
      <div className="w-[min(94vw,540px)] rounded-2xl border border-white/10 bg-navy-900/95 p-5 shadow-2xl backdrop-blur-md sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-danger">
          ⚠ {t("decision.alarmLabel")}
        </p>
        <h2 className="mt-2 text-lg font-bold leading-snug sm:text-xl">
          {t(introDecision.promptKey)}
        </h2>
        <div className="mt-4 flex flex-col gap-2.5">
          {introDecision.options.map((option, index) => (
            <button
              key={option.id}
              type="button"
              onClick={() => choose(option.id)}
              className="group flex items-center gap-3 rounded-xl border border-white/10 bg-navy-800/80 px-4 py-3 text-left text-sm font-medium transition hover:border-safe/60 hover:bg-navy-700"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white/70 group-hover:bg-safe group-hover:text-white">
                {index + 1}
              </span>
              {t(option.labelKey)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
