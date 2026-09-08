import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

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

function PartnerLogos({ label }: { label: string }) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-2">
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-start sm:gap-4">
        <Image
          src="/assets/brand/chevron.png"
          alt="Chevron"
          width={48}
          height={52}
          priority
          className="h-10 w-9 object-contain sm:h-11 sm:w-10"
        />
        <Image
          src="/assets/brand/caravan-of-knowledge.png"
          alt="Caravan of Knowledge"
          width={144}
          height={34}
          priority
          className="h-7 w-[112px] object-contain sm:h-8 sm:w-36"
        />
        <Image
          src="/assets/brand/national-volunteer-network.png"
          alt="Национальная волонтёрская сеть"
          width={126}
          height={40}
          priority
          className="h-8 w-[100px] object-contain sm:h-9 sm:w-[126px]"
        />
        <Image
          src="/assets/brand/saq-horizontal.png"
          alt="SAQ"
          width={78}
          height={42}
          priority
          className="h-10 w-[74px] object-contain sm:h-11 sm:w-[82px]"
        />
      </div>
    </div>
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
      card: "border-[#0066b2]/20 hover:border-[#0066b2]/50",
      accent: "bg-[#0066b2]",
      iconStyle: "bg-[#0066b2]/10 text-[#0066b2]",
      badge: "bg-[#0066b2]/8 text-[#0066b2]",
      cta: "bg-[#0066b2] text-white hover:bg-[#005796]",
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
      card: "border-[#e21836]/20 hover:border-[#e21836]/50",
      accent: "bg-[#e21836]",
      iconStyle: "bg-[#e21836]/10 text-[#e21836]",
      badge: "bg-[#e21836]/8 text-[#c8102e]",
      cta: "bg-[#e21836] text-white hover:bg-[#c8102e]",
    },
  ];

  return (
    <main className="saq-brand-page relative min-h-dvh overflow-hidden bg-[#f5f8fb] text-[#123047]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(#0066b2_1px,transparent_1px),linear-gradient(90deg,#0066b2_1px,transparent_1px)] [background-size:42px_42px]"
      />

      <div className="relative mx-auto flex min-h-dvh max-w-7xl flex-col px-4 sm:px-7 lg:px-10">
        <header className="flex flex-col gap-4 border-b border-[#0066b2]/10 py-4 lg:flex-row lg:items-center lg:justify-between">
          <PartnerLogos label={t("partnersLabel")} />
          <div className="flex items-start justify-between gap-4 lg:items-center lg:justify-end">
            <div className="min-w-0 max-w-[245px] sm:max-w-none lg:text-right">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0066b2]">
                {t("brandEyebrow")}
              </p>
              <p className="mt-1 text-sm font-medium text-slate-500">
                {tGame("subtitle")}
              </p>
            </div>
            <div className="shrink-0">
              <LanguageSwitcher tone="light" />
            </div>
          </div>
        </header>

        <section className="relative mt-5 overflow-hidden bg-[#0066b2] text-white shadow-[0_24px_70px_rgba(0,102,178,0.20)] sm:mt-7">
          <div className="pointer-events-none absolute inset-3 border border-white/35" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full border-[52px] border-white/10"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-32 left-[42%] h-64 w-64 rounded-full bg-[#e21836]/25 blur-3xl"
          />

          <div className="relative grid items-center gap-8 px-7 py-10 sm:px-12 sm:py-14 lg:grid-cols-[1fr_300px] lg:px-16 lg:py-16">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 border border-white/35 bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] backdrop-blur-sm">
                <span className="h-2 w-2 rounded-full bg-[#e21836]" />
                {t("brandTagline")}
              </div>
              <h1 className="mt-5 max-w-3xl text-[2.55rem] font-black leading-[0.98] tracking-[-0.035em] sm:text-6xl lg:text-7xl">
                {t("hero")}
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg">
                {t("lead")}
              </p>
            </div>

            <div className="hidden justify-self-end lg:block">
              <div className="relative flex h-[270px] w-[230px] items-center justify-center bg-white p-8 shadow-2xl">
                <Image
                  src="/assets/brand/saq-vertical.png"
                  alt="SAQ"
                  width={160}
                  height={247}
                  priority
                  className="h-full w-full object-contain"
                />
                <span className="absolute inset-x-0 bottom-0 h-2 bg-[#e21836]" />
              </div>
            </div>
          </div>
        </section>

        <section className="py-9 sm:py-12">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#e21836]">
                SAQ · 180
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-[#123047] sm:text-3xl">
                {t("chooseScenario")}
              </h2>
            </div>
            <Link
              href="/teacher"
              className="text-sm font-bold text-[#0066b2] underline decoration-[#0066b2]/30 underline-offset-4 transition hover:decoration-[#0066b2]"
            >
              {t("teacherDemoLink")} →
            </Link>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {scenarios.map((scenario) => (
              <Link
                key={scenario.number}
                href={scenario.href}
                className={`group relative flex min-h-[300px] flex-col overflow-hidden border-2 bg-white p-6 shadow-[0_14px_40px_rgba(18,48,71,0.07)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_20px_55px_rgba(18,48,71,0.13)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0066b2] sm:p-8 ${scenario.card}`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-0 top-0 h-1.5 ${scenario.accent}`}
                />
                <div className="flex items-start justify-between gap-4">
                  <span
                    className={`flex h-16 w-16 items-center justify-center rounded-full ${scenario.iconStyle}`}
                  >
                    {scenario.icon}
                  </span>
                  <span
                    className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] ${scenario.badge}`}
                  >
                    {t("scenarioNumber", { number: scenario.number })}
                  </span>
                </div>

                <h3 className="mt-6 text-3xl font-black leading-tight tracking-tight text-[#123047]">
                  {scenario.title}
                </h3>
                <p className="mt-1 text-sm font-bold text-[#0066b2]">
                  {scenario.subtitle}
                </p>
                <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-600">
                  {scenario.text}
                </p>

                <div className="mt-auto flex flex-wrap items-end justify-between gap-4 pt-6">
                  <p className="text-xs font-semibold text-slate-400">
                    {scenario.meta}
                  </p>
                  <span
                    className={`inline-flex items-center gap-3 px-5 py-3 text-sm font-black transition ${scenario.cta}`}
                  >
                    {scenario.action}
                    <span
                      aria-hidden="true"
                      className="transition-transform group-hover:translate-x-1"
                    >
                      →
                    </span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <footer className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-[#0066b2]/10 py-5 text-xs text-slate-400">
          <p>{t("brandTagline")}</p>
          <p className="font-bold uppercase tracking-[0.16em] text-[#0066b2]">
            #saq · #kz_nvs
          </p>
        </footer>
      </div>
    </main>
  );
}
