"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { eventBus, type GameEventMap } from "@/game/EventBus";

type Offer = GameEventMap["choice:offer"];

/**
 * Короткий in-world выбор (ученица / учитель). Не тест после каждой комнаты —
 * только когда interaction явно требует ответа.
 */
export function ChoiceOverlay() {
  const t = useTranslations();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [chosen, setChosen] = useState(false);

  useEffect(() => {
    return eventBus.on("choice:offer", (payload) => {
      setChosen(false);
      setOffer(payload);
    });
  }, []);

  const pick = useCallback(
    (optionId: string) => {
      if (chosen || !offer) return;
      setChosen(true);
      eventBus.emit("choice:resolve", { id: offer.id, optionId });
      setOffer(null);
    },
    [chosen, offer],
  );

  // Цифры 1–3: ответ с клавиатуры, чтобы не тянуться к мыши.
  useEffect(() => {
    if (!offer) return;
    const onKey = (e: KeyboardEvent) => {
      const option = offer.options[Number(e.key) - 1];
      if (option) {
        e.preventDefault();
        pick(option.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [offer, pick]);

  if (!offer) return null;

  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-end justify-center bg-navy-950/30 pb-8 sm:items-center sm:pb-0">
      <div className="w-[min(94vw,480px)] rounded-2xl border border-white/10 bg-navy-900/95 p-5 shadow-2xl backdrop-blur-md sm:p-6">
        <h2 className="text-lg font-bold leading-snug sm:text-xl">
          {t(offer.promptKey)}
        </h2>
        <div className="mt-4 flex flex-col gap-2.5">
          {offer.options.map((option, index) => (
            <button
              key={option.id}
              type="button"
              onClick={() => pick(option.id)}
              className="group flex items-center gap-3 rounded-xl border border-white/10 bg-navy-800/80 px-4 py-3 text-left text-sm font-medium transition hover:border-white/35 hover:bg-navy-700"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white/70">
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
