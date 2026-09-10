import { setRequestLocale } from "next-intl/server";
import { PlayClient } from "@/components/game/PlayClient";
import { introVideoSrc } from "@/game/introVideo";
import { getScenarioPack } from "@/game/scenarios";

export default async function FireSchoolPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const introSrc = introVideoSrc(getScenarioPack("fire-school").intro, locale);

  return (
    <>
      {/* Ранний прогрев интро-ролика до клика «Начать». */}
      {introSrc && (
        <link rel="preload" as="video" href={introSrc} type="video/mp4" />
      )}
      <PlayClient scenarioId="fire-school" />
    </>
  );
}
