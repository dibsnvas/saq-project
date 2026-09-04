import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

/**
 * Иконки сценариев нарисованы толстым контуром без мелких деталей: главная
 * страница адресована школьникам, и картинка должна читаться с расстояния
 * так же быстро, как заголовок.
 */
function QuakeIcon() {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={3.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-9 w-9"
    >
      <path d="M10 21 24 9l14 12" />
      <path d="M14 20v12h20V20" />
      <path d="M21 32v-6h6v6" />
      {/* Разлом под домом: намеренно неровный, чтобы не читался как вода. */}
      <path d="M4 40h9l4 5 5-11 4 8 3-2h11" />
      <path d="M8 13 5 9M40 13l3-4" />
    </svg>
  );
}

function FlameIcon() {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={3.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-9 w-9"
    >
      <path d="M24 5c1 7-4 9-7 13-4 5-5 9-5 12a12 12 0 0 0 24 0c0-6-4-9-6-13-2 3-3 4-5 4 1-6 1-11-1-16Z" />
      <path d="M24 41a6 6 0 0 1-6-6c0-3 3-5 4-8 2 3 8 4 8 8a6 6 0 0 1-6 6Z" />
    </svg>
  );
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const tGame = await getTranslations("game");

  /* Оформление задано строками-литералами, а не собирается из кусков:
     сканер Tailwind видит только целые имена классов. */
  const scenarios = [
    {
      number: "01",
      href: "/quest/earthquake",
      icon: <QuakeIcon />,
      title: t("cards.earthquake.title"),
      subtitle: t("cards.earthquake.subtitle"),
      text: t("cards.earthquake.text"),
      meta: t("cards.earthquake.meta"),
      action: t("cards.earthquake.action"),
      bob: "home-bob",
      card: "border-quake-500/30 bg-quake-100 shadow-[0_8px_0_0_var(--color-quake-500)] hover:shadow-[0_12px_0_0_var(--color-quake-500)]",
      badge: "bg-white/70 text-quake-700",
      icons: "bg-quake-500 text-white",
      cta: "bg-quake-700 text-white",
    },
    {
      number: "02",
      href: "/play/fire-school",
      icon: <FlameIcon />,
      title: t("cards.fire.title"),
      subtitle: t("cards.fire.subtitle"),
      text: t("cards.fire.text"),
      meta: t("cards.fire.meta"),
      action: t("cards.fire.action"),
      bob: "home-bob-delayed",
      card: "border-flame-500/30 bg-flame-100 shadow-[0_8px_0_0_var(--color-flame-500)] hover:shadow-[0_12px_0_0_var(--color-flame-500)]",
      badge: "bg-white/70 text-flame-700",
      icons: "bg-flame-500 text-white",
      cta: "bg-flame-700 text-white",
    },
  ];

  return (
    <main className="relative min-h-dvh overflow-hidden bg-cream-50 text-ink-900">
      {/* Мягкие цветные пятна вместо плоского фона — страница выглядит
          приветливо, но не спорит с текстом за внимание. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -left-32 h-96 w-96 rounded-full bg-sun-400/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 top-24 h-96 w-96 rounded-full bg-flame-500/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-quake-500/15 blur-3xl"
      />

      <div className="relative mx-auto flex min-h-dvh max-w-5xl flex-col px-5 py-6 sm:px-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ink-900 text-sm font-black tracking-tight text-cream-50">
              SAQ
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold">{tGame("title")}</p>
              <p className="text-xs text-ink-600">{tGame("subtitle")}</p>
            </div>
          </div>
          <LanguageSwitcher tone="light" />
        </header>

        <section className="flex flex-1 flex-col justify-center py-12 sm:py-16">
          <h1 className="max-w-3xl text-[2.6rem] font-black leading-[1.05] tracking-tight sm:text-6xl">
            {t("hero")}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-ink-600 sm:text-lg">
            {t("lead")}
          </p>

          <div className="mt-11 grid gap-6 sm:grid-cols-2">
            {scenarios.map((s) => (
              <Link
                key={s.number}
                href={s.href}
                className={`group flex flex-col rounded-[32px] border-2 p-6 transition duration-200 hover:-translate-y-1 focus-visible:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink-900 sm:p-7 ${s.card}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`flex h-16 w-16 items-center justify-center rounded-3xl ${s.icons} ${s.bob}`}
                  >
                    {s.icon}
                  </div>
                  <span
                    className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${s.badge}`}
                  >
                    {t("scenarioNumber", { number: s.number })}
                  </span>
                </div>

                <h2 className="mt-6 text-3xl font-black leading-tight tracking-tight">
                  {s.title}
                </h2>
                <p className="mt-1 text-sm font-bold text-ink-600">
                  {s.subtitle}
                </p>
                <p className="mt-4 text-sm leading-relaxed text-ink-600">
                  {s.text}
                </p>

                <p className="mt-5 text-xs font-semibold text-ink-600/80">
                  {s.meta}
                </p>

                <span
                  className={`mt-6 inline-flex w-fit items-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition group-hover:gap-3 ${s.cta}`}
                >
                  {s.action}
                  <span aria-hidden="true">→</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <footer className="pb-2">
          <Link
            href="/teacher"
            className="text-xs font-semibold text-ink-600 underline-offset-4 transition hover:text-ink-900 hover:underline"
          >
            {t("teacherDemoLink")}
          </Link>
        </footer>
      </div>
    </main>
  );
}
