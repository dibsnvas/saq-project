import { fireApartmentPack } from "./fire-apartment";
import { fireMallPack } from "./fire-mall";
import { fireOfficePack } from "./fire-office";
import { fireSchoolPack } from "./fire-school";
import type { ScenarioId, ScenarioPack } from "./types";

export const SCENARIO_PACKS: Record<ScenarioId, ScenarioPack> = {
  "fire-school": fireSchoolPack,
  "fire-mall": fireMallPack,
  "fire-apartment": fireApartmentPack,
  "fire-office": fireOfficePack,
};

export const DEFAULT_SCENARIO_ID: ScenarioId = "fire-school";

export function getScenarioPack(id: ScenarioId): ScenarioPack {
  return SCENARIO_PACKS[id];
}
