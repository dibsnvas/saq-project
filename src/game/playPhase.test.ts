import { describe, expect, it } from "vitest";
import { shouldShowDecisionOverlay } from "./playPhase";

describe("playPhase gates", () => {
  it("shows decision immediately in decision phase (no poster gate)", () => {
    expect(shouldShowDecisionOverlay("decision")).toBe(true);
  });

  it("hides decision during intro and game", () => {
    expect(shouldShowDecisionOverlay("intro")).toBe(false);
    expect(shouldShowDecisionOverlay("game")).toBe(false);
  });
});
