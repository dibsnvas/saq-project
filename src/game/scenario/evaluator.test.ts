import { describe, expect, it } from "vitest";
import { evaluateScenario } from "./evaluator";
import { createScenarioState } from "./state";

function ev(ids: string[], tStep = 1000) {
  return ids.map((id, i) => ({ id, t: (i + 1) * tStep }));
}

const baseSafePath = [
  "followed_teacher_instruction",
  "left_classroom",
  "assessed_corridor",
  "entered_central_hall",
  "smoke_detected",
  "evacuation_plan_checked",
  "changed_route_after_smoke",
  "used_emergency_exit",
  "descended_stairs",
  "exited_building",
  "reached_assembly",
  "reported_to_teacher",
];

describe("evaluateScenario — expanded fire route", () => {
  it("ideal safe run with plan checked", () => {
    const report = evaluateScenario({
      events: ev(baseSafePath),
      success: true,
      timeMs: 90_000,
      firstDecision: "calm",
      companionHelped: true,
      companionSafe: true,
    });
    expect(report.outcome).toBe("safe");
    expect(report.companion).toBe("safe");
    expect(report.goodActions.length).toBeGreaterThan(0);
    expect(report.riskyActions).toHaveLength(0);
    expect(report.timeline.some((e) => e.id === "evacuation_plan_checked")).toBe(
      true,
    );
    expect(report.timeline.some((e) => e.id === "exited_building")).toBe(true);
  });

  it("correct route without opening the plan is not punished", () => {
    const path = baseSafePath.filter((id) => id !== "evacuation_plan_checked");
    const report = evaluateScenario({
      events: ev(path),
      success: true,
      timeMs: 95_000,
      firstDecision: "assess",
      companionHelped: false,
      companionSafe: false,
    });
    expect(report.outcome).toBe("safe");
    expect(report.riskyActions).not.toContain("debrief.rule.planChecked");
    expect(
      report.goodActions.some((k) => k.includes("changedRoute")),
    ).toBe(true);
  });

  it("plan checked counts as a good route action", () => {
    const report = evaluateScenario({
      events: ev(["evacuation_plan_checked", "used_emergency_exit"]),
      success: true,
      timeMs: 80_000,
      firstDecision: "calm",
      companionHelped: false,
      companionSafe: false,
    });
    expect(report.goodActions).toContain("debrief.rule.planChecked");
  });

  it("following crowd without assessing is a reaction risk", () => {
    const report = evaluateScenario({
      events: ev([
        "rushed_without_assessing",
        "followed_crowd_without_checking",
        "entered_central_hall",
        "used_emergency_exit",
        "exited_building",
        "reached_assembly",
        "reported_to_teacher",
      ]),
      success: true,
      timeMs: 70_000,
      firstDecision: "rush",
      companionHelped: false,
      companionSafe: false,
    });
    expect(report.outcome).toBe("risky");
    expect(report.riskyActions).toContain("debrief.rule.followedCrowd");
    expect(report.lessonKey).toMatch(/followedCrowd|rushed/);
  });

  it("attempted reentry is a completion risk with dedicated lesson", () => {
    const report = evaluateScenario({
      events: ev([
        ...baseSafePath.filter((id) => id !== "evacuation_plan_checked"),
        "attempted_reentry",
      ]),
      success: true,
      timeMs: 100_000,
      firstDecision: "calm",
      companionHelped: false,
      companionSafe: false,
    });
    expect(report.outcome).toBe("risky");
    expect(report.riskyActions).toContain("debrief.rule.attemptedReentry");
    expect(report.lessonKey).toBe("debrief.lesson.attemptedReentry");
  });

  it("companion safe is reflected when helped and reached assembly", () => {
    const report = evaluateScenario({
      events: ev([
        "helped_student",
        "companion_safe",
        "reached_assembly",
        "reported_to_teacher",
      ]),
      success: true,
      timeMs: 88_000,
      firstDecision: "calm",
      companionHelped: true,
      companionSafe: true,
    });
    expect(report.companion).toBe("safe");
    expect(report.goodActions).toContain("debrief.rule.helpedCompanion");
  });

  it("timeout before vestibule is timeout outcome", () => {
    const report = evaluateScenario({
      events: ev([
        "left_classroom",
        "entered_central_hall",
        "used_emergency_exit",
        "time_up",
      ]),
      success: false,
      timeMs: 180_000,
      firstDecision: "calm",
      companionHelped: false,
      companionSafe: false,
    });
    expect(report.outcome).toBe("timeout");
    expect(report.lessonKey).toMatch(/timeout|default/);
  });

  it("timeout outdoors before teacher report is timeout", () => {
    const report = evaluateScenario({
      events: ev([
        "exited_building",
        "reached_assembly",
        "time_up",
      ]),
      success: false,
      timeMs: 180_000,
      firstDecision: "assess",
      companionHelped: true,
      companionSafe: false,
    });
    expect(report.outcome).toBe("timeout");
    expect(report.companion).toBe("helped");
    expect(report.timeline.some((e) => e.id === "time_up")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Branching outcomes: 4 итоговых типа, corrected mistakes, companion
// ---------------------------------------------------------------------------

const COMPLETION = [
  "used_emergency_exit",
  "descended_stairs",
  "exited_building",
  "reached_assembly",
  "reported_to_teacher",
];

function run(
  ids: string[],
  opts: Partial<Parameters<typeof evaluateScenario>[0]> = {},
) {
  return evaluateScenario({
    events: ev(ids),
    success: true,
    timeMs: 100_000,
    firstDecision: "calm",
    companionHelped: false,
    companionSafe: false,
    teacherInterventions: 0,
    ...opts,
  });
}

describe("branching outcomes", () => {
  it("A: independent via evacuation plan", () => {
    const report = run([
      "followed_teacher_instruction",
      "left_classroom",
      "assessed_corridor",
      "entered_central_hall",
      "smoke_detected",
      "evacuation_plan_checked",
      "changed_route_after_smoke",
      "took_calm_lane",
      ...COMPLETION,
    ]);
    expect(report.profile.outcome).toBe("safe_independent");
    expect(report.profile.awareness).toBe("strong");
    expect(report.profile.completion).toBe("strong");
    expect(report.profile.correctedMistakes).toHaveLength(0);
  });

  it("B: independent via safe exit sign without plan", () => {
    const report = run(
      [
        "assessed_environment",
        "left_classroom",
        "assessed_corridor",
        "entered_central_hall",
        "safe_exit_sign_detected",
        "stairs_flow_used",
        ...COMPLETION,
      ],
      { firstDecision: "assess" },
    );
    expect(report.profile.outcome).toBe("safe_independent");
    expect(report.riskyActions).toHaveLength(0);
  });

  it("C: independent via early understanding of teacher instruction", () => {
    const report = run([
      "followed_teacher_instruction",
      "assessed_corridor",
      "entered_central_hall",
      "smoke_detected",
      "route_smoke_warning",
      "teacher_instruction_followed",
      "changed_route_after_smoke",
      ...COMPLETION,
    ]);
    expect(report.profile.outcome).toBe("safe_independent");
  });

  it("D: guidance after teacher intervention with low awareness", () => {
    const report = run(
      [
        "rushed_without_assessing",
        "followed_crowd_without_checking",
        "entered_central_hall",
        "smoke_detected",
        "route_blocked",
        "teacher_intervened",
        ...COMPLETION,
      ],
      { firstDecision: "rush", teacherInterventions: 1 },
    );
    expect(report.profile.outcome).toBe("safe_with_guidance");
    expect(report.profile.teacherInterventions).toBe(1);
  });

  it("E: risky but complete (backpack + pushing + reentry)", () => {
    const report = run(
      [
        "returned_for_belongings",
        "backpack_note",
        "entered_central_hall",
        "evacuation_plan_checked",
        "pushed_through_crowd",
        "attempted_reentry",
        ...COMPLETION,
      ],
      { firstDecision: "backpack" },
    );
    expect(report.profile.outcome).toBe("safe_with_risks");
    expect(report.profile.completion).toBe("developing");
  });

  it("crowd following corrected by checking the plan can stay independent", () => {
    const report = run([
      "followed_teacher_instruction",
      "followed_crowd_without_checking",
      "entered_central_hall",
      "smoke_detected",
      "evacuation_plan_checked",
      "crowd_following_corrected",
      "changed_route_after_smoke",
      ...COMPLETION,
    ]);
    expect(report.profile.outcome).toBe("safe_independent");
    expect(report.profile.correctedMistakes).toContain(
      "debrief.correction.crowdChecked",
    );
  });

  it("smoke approach with quick retreat (no warning) stays independent", () => {
    const report = run([
      "followed_teacher_instruction",
      "assessed_corridor",
      "entered_central_hall",
      "smoke_detected",
      "smoke_approach_corrected",
      "evacuation_plan_checked",
      "changed_route_after_smoke",
      ...COMPLETION,
    ]);
    expect(report.profile.outcome).toBe("safe_independent");
  });

  it("smoke linger (route_blocked) then retreat is risky but corrected", () => {
    const report = run([
      "followed_teacher_instruction",
      "entered_central_hall",
      "smoke_detected",
      "route_blocked",
      "smoke_approach_corrected",
      "evacuation_plan_checked",
      "changed_route_after_smoke",
      ...COMPLETION,
    ]);
    expect(report.profile.outcome).toBe("safe_with_risks");
    expect(report.profile.correctedMistakes).toContain(
      "debrief.correction.smokeRetreat",
    );
  });

  it("crowd-only route lowers awareness below independent", () => {
    const report = run([
      "followed_teacher_instruction",
      "entered_central_hall",
      "smoke_detected",
      "route_smoke_warning",
      "crowd_following_route",
      "changed_route_after_smoke",
      ...COMPLETION,
    ]);
    expect(report.profile.outcome).toBe("safe_with_risks");
    expect(report.riskyActions).toContain("debrief.rule.crowdReliance");
  });

  it("pushing then calm lane counts as corrected", () => {
    const report = run([
      "followed_teacher_instruction",
      "assessed_corridor",
      "entered_central_hall",
      "evacuation_plan_checked",
      "changed_route_after_smoke",
      "pushed_through_crowd",
      "stairs_pushing_corrected",
      "took_calm_lane",
      ...COMPLETION,
    ]);
    expect(report.profile.correctedMistakes).toContain(
      "debrief.correction.calmLaneSwitch",
    );
    expect(report.profile.outcome).toBe("safe_independent");
  });

  it("rush corrected by assessing the corridor", () => {
    const report = run(
      [
        "rushed_without_assessing",
        "assessed_corridor",
        "entered_central_hall",
        "evacuation_plan_checked",
        "changed_route_after_smoke",
        ...COMPLETION,
      ],
      { firstDecision: "rush" },
    );
    expect(report.profile.correctedMistakes).toContain(
      "debrief.correction.rushAssessed",
    );
    expect(report.profile.outcome).toBe("safe_independent");
  });

  it("companion not helped is neutral", () => {
    const report = run([
      "followed_teacher_instruction",
      "assessed_corridor",
      "evacuation_plan_checked",
      "changed_route_after_smoke",
      ...COMPLETION,
    ]);
    expect(report.profile.companion).toBe("not_helped");
    expect(report.profile.outcome).toBe("safe_independent");
  });

  it("companion safe at assembly", () => {
    const report = run(
      ["helped_student", "companion_safe", ...COMPLETION],
      { companionHelped: true, companionSafe: true },
    );
    expect(report.profile.companion).toBe("safe_at_assembly");
  });

  it("risky help attempt: smoke linger while escorting", () => {
    const report = run(
      [
        "helped_student",
        "entered_central_hall",
        "route_blocked",
        ...COMPLETION,
      ],
      { companionHelped: true, companionSafe: false },
    );
    expect(report.profile.companion).toBe("help_attempt_risky");
  });

  it("intervention with high awareness is risks, not guidance", () => {
    const report = run(
      [
        "assessed_environment",
        "assessed_corridor",
        "evacuation_plan_checked",
        "smoke_noticed_from_distance",
        "teacher_intervened",
        ...COMPLETION,
      ],
      { teacherInterventions: 1 },
    );
    expect(report.profile.outcome).toBe("safe_with_risks");
  });

  it("reached assembly without report is incomplete", () => {
    const report = run(
      [
        "exited_building",
        "reached_assembly",
        "time_up",
      ],
      { success: false },
    );
    expect(report.profile.outcome).toBe("incomplete");
    expect(report.profile.completion).toBe("needs_review");
  });

  it("timeout before outdoor is incomplete", () => {
    const report = run(
      ["left_classroom", "entered_central_hall", "time_up"],
      { success: false },
    );
    expect(report.profile.outcome).toBe("incomplete");
  });

  it("identical event history produces identical outcome", () => {
    const events = [
      "followed_teacher_instruction",
      "assessed_corridor",
      "evacuation_plan_checked",
      "changed_route_after_smoke",
      ...COMPLETION,
    ];
    const a = run(events);
    const b = run(events);
    expect(a.profile).toEqual(b.profile);
    expect(a.goodActions).toEqual(b.goodActions);
  });

  it("restart state does not leak branch data between runs", () => {
    const first = createScenarioState();
    first.routeEvidence.push("evacuation_plan");
    first.teacherInterventions = 2;
    const second = createScenarioState();
    expect(second.routeEvidence).toHaveLength(0);
    expect(second.teacherInterventions).toBe(0);
    expect(second.routeEvidence).not.toBe(first.routeEvidence);
  });
});
