"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { DEFAULT_SCENARIO_ID, getScenarioPack } from "@/game/scenarios";
import type { ScenarioId, ScenarioPack } from "@/game/scenarios/types";
import { parseScenario, type ScenarioDefinition } from "@/game/scenario/schema";

/**
 * Какое здание играется на странице. HUD, развилка и интро берут данные
 * отсюда, а не из импорта конкретного scenario.json.
 */
const ScenarioContext = createContext<ScenarioId>(DEFAULT_SCENARIO_ID);

export function ScenarioProvider({
  id,
  children,
}: {
  id: ScenarioId;
  children: ReactNode;
}) {
  return (
    <ScenarioContext.Provider value={id}>{children}</ScenarioContext.Provider>
  );
}

export function useScenarioPack(): ScenarioPack {
  return getScenarioPack(useContext(ScenarioContext));
}

export function useScenarioDefinition(): ScenarioDefinition {
  const pack = useScenarioPack();
  return useMemo(() => parseScenario(pack.scenario), [pack]);
}
