import { setRequestLocale } from "next-intl/server";
import { QuestClient } from "@/components/quest/QuestClient";

export default async function EarthquakeQuestPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <QuestClient questId="earthquake" />;
}
