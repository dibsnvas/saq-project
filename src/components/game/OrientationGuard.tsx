"use client";

import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

/**
 * Полноэкранная заглушка для портретного режима на телефоне.
 * Canvas в этот момент не монтируется вовсе.
 */
export function OrientationGuard() {
  const t = useTranslations();

  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-6 bg-navy-950 px-8 text-center">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      {/* Пиктограмма поворота телефона */}
      <svg
        width="72"
        height="72"
        viewBox="0 0 72 72"
        fill="none"
        aria-hidden="true"
        className="animate-pulse"
      >
        <rect
          x="24"
          y="10"
          width="24"
          height="44"
          rx="4"
          stroke="#eef2f8"
          strokeWidth="3"
        />
        <path
          d="M14 60c10 8 34 8 44 0"
          stroke="#2fae5f"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M54 63l5-3-5-3"
          stroke="#2fae5f"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <p className="text-lg font-semibold">{t("game.rotate")}</p>
      <p className="text-xs text-white/40">{t("game.title")}</p>
    </div>
  );
}
