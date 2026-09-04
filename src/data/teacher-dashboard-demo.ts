/**
 * Демонстрационные данные панели учителя.
 * Не связаны с ScenarioState / реальными прохождениями.
 */

export type DemoOutcomeId =
  | "safe_independent"
  | "safe_with_guidance"
  | "safe_with_risks"
  | "incomplete";

export type DemoStudentStatus = "completed" | "incomplete";

export interface DemoKpi {
  id: "completed" | "safeShare" | "avgTime" | "teacherHelp";
  value: string;
}

export interface DemoOutcomeRow {
  id: DemoOutcomeId;
  count: number;
}

export interface DemoRiskRow {
  id: "crowd" | "pushing" | "smoke" | "reentry";
  percent: number;
}

export interface DemoSkillRow {
  id: "safety" | "awareness" | "completion";
  percent: number;
}

export interface DemoStudentRow {
  id: string;
  labelIndex: number;
  outcome: DemoOutcomeId;
  time: string;
  riskKey: "none" | "crowd" | "smoke" | "noReport" | "pushing" | "hint";
  status: DemoStudentStatus;
}

export const TEACHER_DASHBOARD_DEMO = {
  totalStudents: 32,
  completedCount: 28,
  kpis: [
    { id: "completed", value: "28" },
    { id: "safeShare", value: "75%" },
    { id: "avgTime", value: "2:14" },
    { id: "teacherHelp", value: "21%" },
  ] satisfies DemoKpi[],
  outcomes: [
    { id: "safe_independent", count: 12 },
    { id: "safe_with_guidance", count: 6 },
    { id: "safe_with_risks", count: 7 },
    { id: "incomplete", count: 3 },
  ] satisfies DemoOutcomeRow[],
  risks: [
    { id: "crowd", percent: 43 },
    { id: "pushing", percent: 32 },
    { id: "smoke", percent: 29 },
    { id: "reentry", percent: 14 },
  ] satisfies DemoRiskRow[],
  skills: [
    { id: "safety", percent: 74 },
    { id: "awareness", percent: 61 },
    { id: "completion", percent: 86 },
  ] satisfies DemoSkillRow[],
  students: [
    {
      id: "s01",
      labelIndex: 1,
      outcome: "safe_independent",
      time: "1:54",
      riskKey: "none",
      status: "completed",
    },
    {
      id: "s02",
      labelIndex: 2,
      outcome: "safe_with_risks",
      time: "2:31",
      riskKey: "crowd",
      status: "completed",
    },
    {
      id: "s03",
      labelIndex: 3,
      outcome: "safe_with_guidance",
      time: "2:42",
      riskKey: "smoke",
      status: "completed",
    },
    {
      id: "s04",
      labelIndex: 4,
      outcome: "incomplete",
      time: "3:00",
      riskKey: "noReport",
      status: "incomplete",
    },
    {
      id: "s05",
      labelIndex: 5,
      outcome: "safe_independent",
      time: "2:03",
      riskKey: "none",
      status: "completed",
    },
    {
      id: "s06",
      labelIndex: 6,
      outcome: "safe_with_risks",
      time: "2:47",
      riskKey: "pushing",
      status: "completed",
    },
    {
      id: "s07",
      labelIndex: 7,
      outcome: "safe_with_guidance",
      time: "2:36",
      riskKey: "hint",
      status: "completed",
    },
    {
      id: "s08",
      labelIndex: 8,
      outcome: "safe_independent",
      time: "1:49",
      riskKey: "none",
      status: "completed",
    },
  ] satisfies DemoStudentRow[],
} as const;

export const OUTCOME_BAR_MAX = Math.max(
  ...TEACHER_DASHBOARD_DEMO.outcomes.map((o) => o.count),
);
