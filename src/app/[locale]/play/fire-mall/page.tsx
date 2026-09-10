import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { PlayClient } from "@/components/game/PlayClient";
import { deepMerge } from "@/i18n/deepMerge";

export default async function FireMallPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Общие тексты игры + наложение ТРЦ: охранник вместо учителя, ребёнок
  // вместо одноклассницы, сумка вместо рюкзака, названия комнат.
  const base = (await getMessages()) as Record<string, unknown>;
  const overrides = (
    await import(`../../../../content/fire-mall/messages.${locale}.json`)
  ).default as Record<string, unknown>;

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={deepMerge(base, overrides)}
    >
      <PlayClient scenarioId="fire-mall" />
    </NextIntlClientProvider>
  );
}
