import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { PlayClient } from "@/components/game/PlayClient";
import { deepMerge } from "@/i18n/deepMerge";

export default async function FireApartmentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Общие тексты игры + наложение квартиры: сестрёнка, сосед, пожарный,
  // решения на кухне, у двери и в подъезде.
  const base = (await getMessages()) as Record<string, unknown>;
  const overrides = (
    await import(`../../../../content/fire-apartment/messages.${locale}.json`)
  ).default as Record<string, unknown>;

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={deepMerge(base, overrides)}
    >
      <PlayClient scenarioId="fire-apartment" />
    </NextIntlClientProvider>
  );
}
