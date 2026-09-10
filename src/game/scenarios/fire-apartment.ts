import scenario from "@/content/fire-apartment/scenario.json";
import rules from "@/content/fire-apartment/rules.json";
import { OBJECT_TEX } from "../assets";
import { ROOM_ENTER_MESSAGE } from "../rooms/layouts";
import {
  APARTMENT_ROOM_LAYOUTS,
  APT_BG,
  APT_TEX,
} from "../rooms/apartmentLayouts";
import { MALL_NPC_TEX } from "../rooms/mallLayouts";
import { extendPolicy } from "../scenario/evaluator";
import type { ScenarioPack } from "./types";

/**
 * «Пожар в квартире»: здесь правильно не выбежать, а вовремя остановиться.
 * Сковороду гасят крышкой, дверь проверяют ладонью, в дым на лестнице не
 * идут — возвращаются, закрывают щели, звонят 101 и ждут на балконе.
 * Во дворе — сказать пожарному, кто остался в доме.
 */
export const fireApartmentPack: ScenarioPack = {
  id: "fire-apartment",
  scenario,
  layouts: APARTMENT_ROOM_LAYOUTS,
  // Ключи те же, что у школы: тексты комнат подменяет наложение словаря.
  roomEnterMessage: ROOM_ENTER_MESSAGE,
  assets: [
    { key: APT_BG.kitchen, url: "assets/apartment/apt_kitchen.jpg" },
    { key: APT_BG.hallway, url: "assets/apartment/apt_hallway.jpg" },
    { key: APT_BG.landing, url: "assets/apartment/apt_landing.jpg" },
    { key: APT_BG.street, url: "assets/apartment/apt_street.jpg" },

    // Спрайты: nano_banana_2 на #00FF00, фон вырезан scripts/chroma-key.py.
    {
      key: APT_TEX.sisterConfused,
      url: "assets/apartment/npc/sister_confused.png",
    },
    { key: APT_TEX.sisterIdle, url: "assets/apartment/npc/sister_idle.png" },
    { key: APT_TEX.sisterWalk, url: "assets/apartment/npc/sister_walk.png" },
    { key: APT_TEX.firefighter, url: "assets/apartment/npc/firefighter.png" },
    { key: APT_TEX.flame, url: "assets/apartment/flame.png" },
    { key: APT_TEX.panLid, url: "assets/apartment/pan_lid.png" },
    { key: APT_TEX.towels, url: "assets/apartment/towels.png" },

    // Соседи и жильцы во дворе — персонажи ТРЦ.
    { key: MALL_NPC_TEX.manIdle, url: "assets/mall/npc/man_idle.png" },
    { key: MALL_NPC_TEX.womanWalk, url: "assets/mall/npc/woman_walk.png" },
    {
      key: MALL_NPC_TEX.groupAssembly,
      url: "assets/mall/npc/group_assembly.png",
    },

    { key: OBJECT_TEX.backpack, url: "assets/objects/backpack_object.png" },
  ],
  intro: {
    video: null,
    videoByLocale: {},
    poster: "/assets/apartment/poster.jpg",
    nameKey: "scenario.fireApartment.name",
  },
  next: { href: "/play/fire-office", labelKey: "debrief.nextLocationOffice" },
  companion: {
    idleTexture: APT_TEX.sisterIdle,
    walkTexture: APT_TEX.sisterWalk,
    role: "child",
    figureFill: 0.96,
    assemblyAt: { x: 1010, y: 614 },
  },
  bubbles: {
    ru: {
      together: "Я с тобой!",
      wait: "Я подожду…",
      accept: "Хорошо",
      stay: "Мне страшно…",
      redirect: "Назад! Внизу дым!",
      reportAck: "Понял! Идём за ней.",
    },
    kk: {
      together: "Мен сенімен!",
      wait: "Күте тұрамын…",
      accept: "Жарайды",
      stay: "Маған қорқынышты…",
      redirect: "Кері! Төменде түтін!",
      reportAck: "Түсіндім! Соған барамыз.",
    },
  },
  calmVoices: {
    ru: ["ne_toropites"],
    kk: ["asykpandar"],
  },
  geometry: {
    corridorViewRect: { x: 560, y: 482, width: 200, height: 60 },
    // Дым поднимается по лестнице в центре; у нашей двери — далеко от него.
    hallFarFromSmokeMinY: 640,
    interventionPush: { x: 60, y: 50 },
    stairsTowardExitMaxX: 700,
    reentryPushX: 60,
    backpack: { textureKey: OBJECT_TEX.backpack, fallback: { x: 540, y: 636 } },
  },
  policy: extendPolicy({
    rules,
    awarenessWeights: {
      door_checked: 2,
      smoke_noticed_from_distance: 1,
      returned_to_apartment: 1,
      teacher_instruction_followed: 1,
      called_rescue: 1,
      opened_door_unchecked: -1,
      teacher_intervened: -2,
    },
    safetyWeights: {
      pan_covered: 1,
      returned_to_apartment: 1,
      sealed_door_gaps: 1,
      called_rescue: 1,
      companion_safe: 1,
      pan_flared: -2,
      opened_door_unchecked: -1,
      student_help_declined: -1,
      backpack_note: -1,
      route_blocked: -3,
      attempted_reentry: -2,
    },
    criticalRisks: [
      "pan_flared",
      "opened_door_unchecked",
      "route_blocked",
      "student_help_declined",
      "backpack_note",
      "attempted_reentry",
    ],
    riskFix: { route_blocked: "smoke_approach_corrected" },
    correctionRefund: { route_blocked: 1 },
    corrections: [
      {
        id: "smoke_retreat",
        riskEvent: "route_blocked",
        fixEvent: "smoke_approach_corrected",
        messageKey: "debrief.correction.smokeRetreat",
      },
    ],
    timeline: [
      { id: "pan_covered", labelKey: "debrief.timeline.decision" },
      { id: "pan_flared", labelKey: "debrief.timeline.decision" },
      { id: "helped_student", labelKey: "debrief.timeline.helped" },
      { id: "door_checked", labelKey: "debrief.timeline.doorChecked" },
      {
        id: "opened_door_unchecked",
        labelKey: "debrief.timeline.doorUnchecked",
      },
      { id: "smoke_detected", labelKey: "debrief.timeline.smoke" },
      {
        id: "teacher_intervened",
        labelKey: "debrief.timeline.teacherIntervened",
      },
      {
        id: "returned_to_apartment",
        labelKey: "debrief.timeline.returnedHome",
      },
      { id: "sealed_door_gaps", labelKey: "debrief.timeline.sealedDoor" },
      { id: "called_rescue", labelKey: "debrief.timeline.calledRescue" },
      { id: "waited_on_balcony", labelKey: "debrief.timeline.balcony" },
      { id: "reached_assembly", labelKey: "debrief.timeline.assembly" },
      { id: "reported_to_teacher", labelKey: "debrief.timeline.reported" },
      { id: "time_up", labelKey: "debrief.timeline.timeUp" },
    ],
    lessonPriority: [
      "pan_flared",
      "lingered_in_smoke",
      "opened_door_unchecked",
      "attempted_reentry",
      "student_help_declined",
      "teacher_intervened",
      "backpack_temptation",
      "time_up",
    ],
  }),
  // Коридор квартиры — не «поток людей»: оценка заминки там не нужна.
  mechanics: { corridorAssess: false },
  helpChoice: {
    promptKey: "choice.helpStudent.prompt",
    options: [
      { id: "companion", labelKey: "choice.helpStudent.together" },
      { id: "declined", labelKey: "choice.helpStudent.cannot" },
    ],
  },
  minimap: false,
};
