import Phaser from "phaser";
import { parseScenario } from "./scenario/schema";
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  PALETTE,
  REGISTRY_DEBUG_COLLISIONS,
  REGISTRY_DEBUG_NPC_PATHS,
  REGISTRY_DEBUG_PERSPECTIVE,
  REGISTRY_PACK_KEY,
  REGISTRY_SCENARIO_KEY,
} from "./constants";
import { DEFAULT_SCENARIO_ID, getScenarioPack } from "./scenarios";
import type { ScenarioId } from "./scenarios/types";
import { BootScene } from "./scenes/BootScene";
import { PreloadScene } from "./scenes/PreloadScene";
import { SchoolScene } from "./scenes/SchoolScene";
import { DebriefScene } from "./scenes/DebriefScene";

export * from "./constants";

export function createGame(
  parent: HTMLElement,
  scenarioId: ScenarioId = DEFAULT_SCENARIO_ID,
): Phaser.Game {
  const pack = getScenarioPack(scenarioId);
  // Валидируем данные сценария на входе: битый scenario.json падает громко
  // и сразу, а не тихо посреди прохождения.
  const scenario = parseScenario(pack.scenario);

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: PALETTE.background,
    physics: {
      default: "arcade",
      arcade: { debug: false },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, PreloadScene, SchoolScene, DebriefScene],
    callbacks: {
      preBoot: (g) => {
        g.registry.set(REGISTRY_SCENARIO_KEY, scenario);
        g.registry.set(REGISTRY_PACK_KEY, pack);
        const params =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search)
            : null;
        g.registry.set(
          REGISTRY_DEBUG_PERSPECTIVE,
          params?.get("debugPerspective") === "1",
        );
        g.registry.set(
          REGISTRY_DEBUG_COLLISIONS,
          params?.get("debugCollisions") === "1",
        );
        g.registry.set(
          REGISTRY_DEBUG_NPC_PATHS,
          params?.get("debugNpcPaths") === "1",
        );
      },
    },
  });

  // Dev/playwright hook: единственный Phaser.Game на странице.
  if (typeof window !== "undefined") {
    (window as unknown as { __saqGame?: Phaser.Game }).__saqGame = game;
  }
  return game;
}
