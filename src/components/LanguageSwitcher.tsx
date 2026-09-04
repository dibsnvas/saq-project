"use client";

import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";

const LABELS: Record<AppLocale, string> = {
  ru: "РУС",
  kk: "ҚАЗ",
};

/**
 * Переключение языка = переход на тот же путь в другой локали.
 * Интерфейс всегда показывает только один язык.
 */
export function LanguageSwitcher({
  tone = "dark",
}: {
  tone?: "dark" | "light";
}) {
  const locale = useLocale();
  const pathname = usePathname();
  const light = tone === "light";

  return (
    <div
      className={`flex overflow-hidden rounded-md border text-xs font-semibold ${
        light ? "border-navy-900/15" : "border-white/15"
      }`}
    >
      {routing.locales.map((l) => (
        <Link
          key={l}
          href={pathname}
          locale={l}
          aria-current={l === locale ? "true" : undefined}
          className={
            l === locale
              ? light
                ? "bg-navy-900 px-2.5 py-1 text-white"
                : "bg-white/90 px-2.5 py-1 text-navy-900"
              : light
                ? "bg-white px-2.5 py-1 text-navy-700/70 hover:text-navy-900"
                : "bg-navy-800/80 px-2.5 py-1 text-white/70 hover:text-white"
          }
        >
          {LABELS[l]}
        </Link>
      ))}
    </div>
  );
}
