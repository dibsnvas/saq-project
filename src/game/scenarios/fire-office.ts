import scenario from "@/content/fire-office/scenario.json";
import rules from "@/content/fire-office/rules.json";
import { OBJECT_TEX, PLAYER_TEX } from "../assets";
import { ROOM_ENTER_MESSAGE } from "../rooms/layouts";
import { MALL_NPC_TEX } from "../rooms/mallLayouts";
import {
  OFFICE_BG,
  OFFICE_ROOM_LAYOUTS,
  OFFICE_TEX,
} from "../rooms/officeLayouts";
import {
  AWARENESS_WEIGHTS,
  CRITICAL_RISKS,
  SAFETY_WEIGHTS,
} from "../scenario/branching";
import { DEFAULT_POLICY, extendPolicy } from "../scenario/evaluator";
import type { ScenarioPack } from "./types";

/**
 * «Пожар в офисе»: школьный маршрут ролей. Главное — лифтом при пожаре не
 * пользуются (лифты — «главный выход» холла, из шахты идёт дым), в дымном
 * коридоре пригибаются и закрывают рот тканью, на месте сбора
 * докладывают ответственному за эвакуацию.
 */
export const fireOfficePack: ScenarioPack = {
  id: "fire-office",
  scenario,
  layouts: OFFICE_ROOM_LAYOUTS,
  roomEnterMessage: ROOM_ENTER_MESSAGE,
  assets: [
    { key: OFFICE_BG.room, url: "assets/office/office_room.jpg" },
    { key: OFFICE_BG.corridor, url: "assets/office/office_corridor.jpg" },
    { key: OFFICE_BG.liftHall, url: "assets/office/office_lift_hall.jpg" },
    { key: OFFICE_BG.stairs, url: "assets/office/office_stairs.jpg" },
    { key: OFFICE_BG.lobby, url: "assets/office/office_lobby.jpg" },
    { key: OFFICE_BG.yard, url: "assets/office/office_yard.jpg" },

    // Спрайты: nano_banana_2 на #00FF00, фон вырезан scripts/chroma-key.py.
    { key: OFFICE_TEX.momIdle, url: "assets/office/npc/mom_idle.png" },
    { key: OFFICE_TEX.momWalk, url: "assets/office/npc/mom_walk.png" },
    { key: OFFICE_TEX.wardenIdle, url: "assets/office/npc/warden_idle.png" },
    { key: OFFICE_TEX.wardenWalk, url: "assets/office/npc/warden_walk.png" },
    {
      key: OFFICE_TEX.groupEvacuating,
      url: "assets/office/npc/group_evacuating.png",
    },
    {
      key: OFFICE_TEX.groupAssembly,
      url: "assets/office/npc/group_assembly.png",
    },
    // Поза «пригнувшись, рот закрыт рукавом» — для дымного коридора.
    {
      key: PLAYER_TEX.crouch.back,
      url: "assets/player/player_crouch_back.png",
    },
    {
      key: PLAYER_TEX.crouch.side,
      url: "assets/player/player_crouch_side.png",
    },

    // Сотрудники и посетительница — персонажи ТРЦ.
    { key: MALL_NPC_TEX.manIdle, url: "assets/mall/npc/man_idle.png" },
    { key: MALL_NPC_TEX.manWalk, url: "assets/mall/npc/man_walk.png" },
    { key: MALL_NPC_TEX.womanIdle, url: "assets/mall/npc/woman_idle.png" },
    { key: MALL_NPC_TEX.womanWalk, url: "assets/mall/npc/woman_walk.png" },
    { key: MALL_NPC_TEX.pairWalking, url: "assets/mall/npc/pair_walking.png" },

    { key: OBJECT_TEX.backpack, url: "assets/objects/backpack_object.png" },
  ],
  intro: {
    video: null,
    videoByLocale: {},
    poster: "/assets/office/poster.jpg",
    nameKey: "scenario.fireOffice.name",
  },
  companion: {
    idleTexture: MALL_NPC_TEX.womanIdle,
    walkTexture: MALL_NPC_TEX.womanWalk,
    role: "adult",
    figureFill: 0.97,
    assemblyAt: { x: 1045, y: 610 },
  },
  bubbles: {
    ru: {
      together: "Спасибо, иду с вами",
      wait: "Подожду ответственного",
      accept: "Помогу, идите",
      stay: "Я здесь постою…",
      redirect: "Все на лестницу! Лифт нельзя!",
      reportAck: "Отметил. Все на месте.",
    },
    kk: {
      together: "Рақмет, сізбен барамын",
      wait: "Жауаптыны күтемін",
      accept: "Көмектесемін, жүре беріңіз",
      stay: "Осында тұра тұрайын…",
      redirect: "Бәрі баспалдаққа! Лифтке болмайды!",
      reportAck: "Белгіледім. Бәрі осында.",
    },
  },
  calmVoices: {
    ru: ["sohranyaite_spokoistvie", "ne_toropites"],
    kk: ["sabyr_saqtandar", "asykpandar"],
  },
  geometry: {
    corridorViewRect: { x: 560, y: 402, width: 260, height: 90 },
    hallFarFromSmokeMinY: 600,
    interventionPush: { x: 60, y: 60 },
    stairsTowardExitMaxX: 700,
    reentryPushX: 56,
    backpack: {
      textureKey: OBJECT_TEX.backpack,
      fallback: { x: 1000, y: 650 },
    },
  },
  policy: extendPolicy({
    rules,
    awarenessWeights: { ...AWARENESS_WEIGHTS, crouched_in_smoke: 1 },
    safetyWeights: {
      ...SAFETY_WEIGHTS,
      crouched_in_smoke: 1,
      walked_upright_in_smoke: -1,
    },
    criticalRisks: [...CRITICAL_RISKS, "walked_upright_in_smoke"],
    timeline: [
      ...DEFAULT_POLICY.timeline,
      { id: "crouched_in_smoke", labelKey: "debrief.timeline.crouched" },
    ],
    lessonPriority: [
      "lingered_in_smoke",
      "walked_upright_in_smoke",
      ...DEFAULT_POLICY.lessonPriority.filter(
        (id) => id !== "lingered_in_smoke",
      ),
    ],
  }),
};
