import { describe, expect, it } from "vitest";
import {
  shouldRevealCalmLaneHint,
  shouldRevealSafeRouteHint,
} from "./hintPolicy";

describe("hintPolicy", () => {
  it("does not reveal safe route prematurely", () => {
    expect(
      shouldRevealSafeRouteHint({
        routeEvidence: [],
        teacherInterventions: 0,
        fallbackHint: false,
      }),
    ).toBe(false);
  });

  it("reveals after plan/sign/teacher evidence", () => {
    expect(
      shouldRevealSafeRouteHint({
        routeEvidence: ["evacuation_plan"],
        teacherInterventions: 0,
        fallbackHint: false,
      }),
    ).toBe(true);
  });

  it("reveals after teacher intervention or fallback", () => {
    expect(
      shouldRevealSafeRouteHint({
        routeEvidence: [],
        teacherInterventions: 1,
        fallbackHint: false,
      }),
    ).toBe(true);
    expect(
      shouldRevealSafeRouteHint({
        routeEvidence: [],
        teacherInterventions: 0,
        fallbackHint: true,
      }),
    ).toBe(true);
  });

  it("does not highlight calm lane on entry", () => {
    expect(
      shouldRevealCalmLaneHint({
        pushedCrowd: false,
        tookCalmLane: false,
        fallbackHint: false,
      }),
    ).toBe(false);
  });

  it("reveals calm lane after push or fallback", () => {
    expect(
      shouldRevealCalmLaneHint({
        pushedCrowd: true,
        tookCalmLane: false,
        fallbackHint: false,
      }),
    ).toBe(true);
  });
});
