import type { RouteEvidence } from "./scenario/branching";

/** Пороги мягкого fallback-hint (мс без прогресса). */
export const FALLBACK_HINT = {
  corridorMs: 11_000,
  hallAfterMediumMs: 14_000,
  stairsMs: 9_000,
} as const;

/**
 * Зелёный safe-route hint только после осознанного действия
 * (evidence / вопрос учителю / вмешательство / fallback).
 */
export function shouldRevealSafeRouteHint(input: {
  routeEvidence: readonly RouteEvidence[];
  teacherInterventions: number;
  fallbackHint: boolean;
}): boolean {
  return (
    input.routeEvidence.length > 0 ||
    input.teacherInterventions > 0 ||
    input.fallbackHint
  );
}

/** Calm-lane подсветка — только после риска, коррекции или fallback. */
export function shouldRevealCalmLaneHint(input: {
  pushedCrowd: boolean;
  tookCalmLane: boolean;
  fallbackHint: boolean;
}): boolean {
  return input.pushedCrowd || input.tookCalmLane || input.fallbackHint;
}
