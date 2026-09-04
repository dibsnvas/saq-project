import { beforeEach, describe, expect, it, vi } from "vitest";
import { eventBus } from "./EventBus";

describe("EventBus sticky decision:choose", () => {
  beforeEach(() => {
    eventBus.resetForTests();
  });

  it("delivers decision emitted before listener registers (once)", () => {
    const handler = vi.fn();
    eventBus.emit("decision:choose", { optionId: "calm" });
    expect(eventBus.hasSticky("decision:choose")).toBe(true);

    const off = eventBus.on("decision:choose", handler);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ optionId: "calm" });
    expect(eventBus.hasSticky("decision:choose")).toBe(false);

    // Второй listener не получает уже потреблённый sticky.
    const handler2 = vi.fn();
    eventBus.on("decision:choose", handler2);
    expect(handler2).not.toHaveBeenCalled();
    off();
  });

  it("does not sticky when a listener is already present", () => {
    const handler = vi.fn();
    const off = eventBus.on("decision:choose", handler);
    eventBus.emit("decision:choose", { optionId: "assess" });
    expect(handler).toHaveBeenCalledWith({ optionId: "assess" });
    expect(eventBus.hasSticky("decision:choose")).toBe(false);
    off();
  });

  it("clears sticky decision on game:restart", () => {
    eventBus.emit("decision:choose", { optionId: "rush" });
    expect(eventBus.hasSticky("decision:choose")).toBe(true);
    eventBus.emit("game:restart");
    expect(eventBus.hasSticky("decision:choose")).toBe(false);
  });

  it("applyFirstDecision path stays idempotent via single delivery", () => {
    const applied: string[] = [];
    eventBus.emit("decision:choose", { optionId: "backpack" });
    eventBus.on("decision:choose", ({ optionId }) => {
      if (applied.includes(optionId)) return;
      applied.push(optionId);
    });
    eventBus.emit("decision:choose", { optionId: "backpack" });
    // Sticky consumed once + live emit once, guard keeps unique.
    expect(applied).toEqual(["backpack"]);
  });
});
