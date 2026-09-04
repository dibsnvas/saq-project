import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["kk", "ru"],
  // Казахский — язык по умолчанию: «/» и пути без локали ведут на /kk/…
  defaultLocale: "kk",
  localePrefix: "always",
  // Всегда открываем kk по умолчанию, не угадывая по Accept-Language.
  localeDetection: false,
});

export type AppLocale = (typeof routing.locales)[number];
