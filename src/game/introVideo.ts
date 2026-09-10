/**
 * Выбор файла интро-ролика по локали.
 *
 * Ролик может быть живой записью со звуком, поэтому язык записи должен
 * совпадать с языком интерфейса. Локаль без собственной версии откатывается
 * на исходный файл. Какие файлы есть — задаёт пакет сценария.
 *
 * Общий модуль для страницы (там ролик прогревается через <link rel="preload">)
 * и для IntroOverlay — чтобы прогревался ровно тот файл, который потом играет.
 */
export interface IntroVideoSpec {
  /** null — у сценария нет ролика: интро сразу ведёт к первому решению */
  video: string | null;
  videoByLocale: Partial<Record<string, string>>;
}

export function introVideoSrc(
  intro: IntroVideoSpec,
  locale: string,
): string | null {
  if (intro.video === null) return null;
  return intro.videoByLocale[locale] ?? intro.video;
}
