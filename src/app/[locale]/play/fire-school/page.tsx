import { setRequestLocale } from "next-intl/server";
import { PlayClient } from "@/components/game/PlayClient";
import { introVideoSrc } from "@/game/introVideo";

export default async function FireSchoolPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      {/* Ранний прогрев интро-ролика до клика «Начать». */}
      <link
        rel="preload"
        as="video"
        href={introVideoSrc(locale)}
        type="video/mp4"
      />
      <PlayClient />
    </>
  );
}
