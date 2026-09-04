import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  OUTCOME_BAR_MAX,
  TEACHER_DASHBOARD_DEMO,
  type DemoOutcomeId,
} from "@/data/teacher-dashboard-demo";

const OUTCOME_TITLE_KEY: Record<DemoOutcomeId, string> = {
  safe_independent: "teacher.outcome.safeIndependent",
  safe_with_guidance: "teacher.outcome.safeGuidance",
  safe_with_risks: "teacher.outcome.safeRisks",
  incomplete: "teacher.outcome.incomplete",
};

const OUTCOME_BAR_COLOR: Record<DemoOutcomeId, string> = {
  safe_independent: "bg-safe",
  safe_with_guidance: "bg-navy-600",
  safe_with_risks: "bg-[#c4892a]",
  incomplete: "bg-danger/80",
};

const STATUS_CLASS: Record<"completed" | "incomplete", string> = {
  completed: "bg-safe/15 text-safe",
  incomplete: "bg-danger/10 text-danger",
};

export default async function TeacherDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const demo = TEACHER_DASHBOARD_DEMO;

  return (
    <main className="min-h-dvh bg-[#f3f5f9] text-navy-900">
      <header className="border-b border-navy-900/8 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold tracking-tight text-navy-900">
                {t("game.title")}
              </p>
              <span className="rounded-md bg-navy-900/6 px-2 py-0.5 text-[11px] font-medium text-navy-700">
                {t("teacher.demoBadge")}
              </span>
            </div>
            <h1 className="mt-1 text-xl font-bold sm:text-2xl">
              {t("teacher.pageTitle")}
            </h1>
            <p className="mt-0.5 text-sm text-navy-700/70">
              {t("teacher.subtitle")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <LanguageSwitcher tone="light" />
            <Link
              href="/play/fire-school"
              className="rounded-lg bg-safe px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
            >
              {t("teacher.openSimulator")}
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        {/* KPI */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {demo.kpis.map((kpi) => (
            <article
              key={kpi.id}
              className="rounded-xl border border-navy-900/8 bg-white px-4 py-4 shadow-sm"
            >
              <p className="text-xs font-medium text-navy-700/60">
                {t(`teacher.kpi.${kpi.id}`)}
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight">
                {kpi.id === "completed"
                  ? t("teacher.kpi.completedValue", {
                      done: demo.completedCount,
                      total: demo.totalStudents,
                    })
                  : kpi.value}
              </p>
            </article>
          ))}
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Outcomes */}
          <section className="rounded-xl border border-navy-900/8 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold">{t("teacher.outcomesTitle")}</h2>
            <ul className="mt-4 space-y-3">
              {demo.outcomes.map((row) => {
                const width = Math.round((row.count / OUTCOME_BAR_MAX) * 100);
                return (
                  <li key={row.id}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-navy-800">
                        {t(OUTCOME_TITLE_KEY[row.id])}
                      </span>
                      <span className="font-semibold tabular-nums text-navy-900">
                        {row.count}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-navy-900/6">
                      <div
                        className={`h-full rounded-full ${OUTCOME_BAR_COLOR[row.id]}`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Risks */}
          <section className="rounded-xl border border-navy-900/8 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold">{t("teacher.risksTitle")}</h2>
            <ul className="mt-4 space-y-3">
              {demo.risks.map((row) => (
                <li key={row.id}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-navy-800">
                      {t(`teacher.risk.${row.id}`)}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {row.percent}%
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-navy-900/6">
                    <div
                      className="h-full rounded-full bg-danger/75"
                      style={{ width: `${row.percent}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-navy-900/6 pt-3 text-sm leading-relaxed text-navy-700/80">
              {t("teacher.riskInsight")}
            </p>
          </section>
        </div>

        {/* Skills */}
        <section className="rounded-xl border border-navy-900/8 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold">{t("teacher.skillsTitle")}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {demo.skills.map((row) => (
              <div key={row.id}>
                <div className="mb-1.5 flex items-baseline justify-between text-sm">
                  <span className="font-medium text-navy-800">
                    {t(`teacher.skill.${row.id}`)}
                  </span>
                  <span className="tabular-nums font-semibold">
                    {row.percent}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-navy-900/6">
                  <div
                    className="h-full rounded-full bg-navy-700"
                    style={{ width: `${row.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Students table */}
        <section className="overflow-hidden rounded-xl border border-navy-900/8 bg-white shadow-sm">
          <div className="border-b border-navy-900/6 px-5 py-4">
            <h2 className="text-sm font-bold">{t("teacher.tableTitle")}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-navy-900/[0.03] text-xs font-semibold uppercase tracking-wide text-navy-700/55">
                <tr>
                  <th className="px-5 py-3 font-semibold">
                    {t("teacher.col.student")}
                  </th>
                  <th className="px-3 py-3 font-semibold">
                    {t("teacher.col.outcome")}
                  </th>
                  <th className="px-3 py-3 font-semibold">
                    {t("teacher.col.time")}
                  </th>
                  <th className="px-3 py-3 font-semibold">
                    {t("teacher.col.risk")}
                  </th>
                  <th className="px-5 py-3 font-semibold">
                    {t("teacher.col.status")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {demo.students.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-navy-900/6 text-navy-900"
                  >
                    <td className="px-5 py-3 font-medium">
                      {t("teacher.studentLabel", {
                        n: String(row.labelIndex).padStart(2, "0"),
                      })}
                    </td>
                    <td className="px-3 py-3">
                      {t(OUTCOME_TITLE_KEY[row.outcome])}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-navy-800">
                      {row.time}
                    </td>
                    <td className="px-3 py-3 text-navy-800">
                      {t(`teacher.studentRisk.${row.riskKey}`)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[row.status]}`}
                      >
                        {t(`teacher.status.${row.status}`)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Recommendation */}
        <section className="rounded-xl border border-safe/25 bg-white p-5 shadow-sm sm:flex sm:items-start sm:justify-between sm:gap-8">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-navy-900">
              {t("teacher.recommendationTitle")}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-navy-800/85">
              {t("teacher.recommendationBody")}
            </p>
          </div>
          <Link
            href="/play/fire-school"
            className="mt-4 inline-flex shrink-0 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-800 sm:mt-0"
          >
            {t("teacher.rerunTraining")}
          </Link>
        </section>

        <p className="pb-4 text-center text-xs text-navy-700/45">
          {t("teacher.demoBadge")} · {t("game.title")}
        </p>
      </div>
    </main>
  );
}
