/**
 * Выбор файла интро-ролика по локали.
 *
 * Ролик — живая запись урока со звуком, поэтому язык записи должен совпадать
 * с языком интерфейса: иначе русский игрок слышит казахскую речь. Локаль без
 * собственной версии откатывается на исходный файл.
 *
 * Общий модуль для страницы (там ролик прогревается через <link rel="preload">)
 * и для IntroOverlay — чтобы прогревался ровно тот файл, который потом играет.
 */
export const INTRO_VIDEO_DEFAULT = "/videos/fire-school-intro.mp4";

const INTRO_VIDEO_BY_LOCALE: Record<string, string> = {
  ru: "/videos/fire-school-intro.ru.mp4",
};

export function introVideoSrc(locale: string): string {
  return INTRO_VIDEO_BY_LOCALE[locale] ?? INTRO_VIDEO_DEFAULT;
}
