import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  // UI-словарь + отдельно отредактированные тексты сценария.
  // Никакого автоматического перевода в рантайме — только готовые файлы.
  const uiMessages = (await import(`../messages/${locale}.json`)).default;
  const scenarioMessages = (
    await import(`../content/fire-school/${locale}.json`)
  ).default;

  return {
    locale,
    messages: {
      ...uiMessages,
      scenario: { fireSchool: scenarioMessages },
    },
  };
});
