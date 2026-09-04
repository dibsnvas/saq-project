/**
 * Фазы клиентской оболочки PlayClient.
 * DecisionOverlay не должен ждать Phaser preload / poster fade.
 */
export type PlayPhase = "intro" | "decision" | "game";

/** Показать первое решение сразу после intro — без привязки к posterVisible. */
export function shouldShowDecisionOverlay(phase: PlayPhase): boolean {
  return phase === "decision";
}
