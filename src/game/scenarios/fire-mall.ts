import scenario from "@/content/fire-mall/scenario.json";
import { OBJECT_TEX } from "../assets";
import { ROOM_ENTER_MESSAGE } from "../rooms/layouts";
import { MALL_BG, MALL_NPC_TEX, MALL_ROOM_LAYOUTS } from "../rooms/mallLayouts";
import type { ScenarioPack } from "./types";

/**
 * «Пожар в ТРЦ»: тот же маршрут ролей, что в школе. Взрослый-ориентир —
 * охранник, спутник — потерявшийся ребёнок, «вещи» — сумка с покупками.
 * Тексты — наложение поверх общих словарей (content/fire-mall/messages.*).
 */
export const fireMallPack: ScenarioPack = {
  id: "fire-mall",
  scenario,
  layouts: MALL_ROOM_LAYOUTS,
  // Ключи те же, что у школы: тексты комнат подменяет наложение словаря ТРЦ.
  roomEnterMessage: ROOM_ENTER_MESSAGE,
  assets: [
    { key: MALL_BG.shop, url: "assets/mall/mall_shop.jpg" },
    { key: MALL_BG.gallery, url: "assets/mall/mall_gallery.jpg" },
    { key: MALL_BG.atrium, url: "assets/mall/mall_atrium.jpg" },
    { key: MALL_BG.stairs, url: "assets/mall/mall_stairs.jpg" },
    { key: MALL_BG.vestibule, url: "assets/mall/mall_vestibule.jpg" },
    { key: MALL_BG.outdoor, url: "assets/mall/mall_outdoor.jpg" },

    // Персонажи ТРЦ: nano_banana_2 по референсам школьных спрайтов, зелёный
    // фон вырезан локально (см. docs/asset-map.md).
    { key: MALL_NPC_TEX.guardIdle, url: "assets/mall/npc/guard_idle.png" },
    { key: MALL_NPC_TEX.guardWalk, url: "assets/mall/npc/guard_walk.png" },
    { key: MALL_NPC_TEX.manIdle, url: "assets/mall/npc/man_idle.png" },
    { key: MALL_NPC_TEX.manWalk, url: "assets/mall/npc/man_walk.png" },
    { key: MALL_NPC_TEX.womanIdle, url: "assets/mall/npc/woman_idle.png" },
    { key: MALL_NPC_TEX.womanWalk, url: "assets/mall/npc/woman_walk.png" },
    {
      key: MALL_NPC_TEX.childConfused,
      url: "assets/mall/npc/child_confused.png",
    },
    { key: MALL_NPC_TEX.childIdle, url: "assets/mall/npc/child_idle.png" },
    { key: MALL_NPC_TEX.childWalk, url: "assets/mall/npc/child_walk.png" },
    {
      key: MALL_NPC_TEX.groupEvacuating,
      url: "assets/mall/npc/group_evacuating.png",
    },
    {
      key: MALL_NPC_TEX.groupAssembly,
      url: "assets/mall/npc/group_assembly.png",
    },
    { key: MALL_NPC_TEX.pairWalking, url: "assets/mall/npc/pair_walking.png" },

    { key: OBJECT_TEX.backpack, url: "assets/objects/backpack_object.png" },
  ],
  intro: {
    // Ролика пока нет: интро показывает постер и сразу ведёт к развилке.
    video: null,
    videoByLocale: {},
    poster: "/assets/mall/mall_shop.jpg",
    nameKey: "scenario.fireMall.name",
  },
  // Третья локация пожара — квартира.
  next: {
    href: "/play/fire-apartment",
    labelKey: "debrief.nextLocationApartment",
  },
  companion: {
    idleTexture: MALL_NPC_TEX.childIdle,
    walkTexture: MALL_NPC_TEX.childWalk,
    role: "child",
    figureFill: 0.96,
    assemblyAt: { x: 960, y: 600 },
  },
  bubbles: {
    ru: {
      together: "Я с тобой",
      wait: "Жду охранника",
      accept: "Хорошо, я присмотрю",
      stay: "Я подожду здесь",
      redirect: "К запасному выходу!",
      reportAck: "Принято. Все на месте.",
    },
    kk: {
      together: "Сізбен барамын",
      wait: "Күзетшіні күтемін",
      accept: "Жақсы, мен қарап тұрамын",
      stay: "Осында тұрамын",
      redirect: "Қосалқы шығуға!",
      reportAck: "Қабылданды. Бәрі жиналды.",
    },
  },
  // Без «Идите за учителем»: в ТРЦ взрослый-ориентир — охрана.
  calmVoices: {
    ru: ["sohranyaite_spokoistvie", "ne_toropites"],
    kk: ["sabyr_saqtandar", "asykpandar"],
  },
  geometry: {
    corridorViewRect: { x: 560, y: 0, width: 260, height: 475 },
    // Дым приходит к главному входу по центру в глубине атриума.
    hallFarFromSmokeMinY: 590,
    interventionPush: { x: 40, y: 60 },
    stairsTowardExitMaxX: 700,
    reentryPushX: 56,
    backpack: { textureKey: OBJECT_TEX.backpack, fallback: { x: 560, y: 614 } },
  },
};
