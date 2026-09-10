import { FX_ANIM, FX_TEX, OBJECT_TEX } from "../assets";
import { MALL_NPC_TEX } from "./mallLayouts";
import type { RoomId, RoomLayout } from "./types";

/**
 * Раскладки сценария «Пожар в квартире». Роли комнат школьные, маршрут свой:
 * кухня (старт, горит сковорода) → коридор (сестрёнка, проверка двери) →
 * подъезд (снизу дым — вернуться) → снова коридор (полотенца, 101, балкон) →
 * двор (сказать пожарному, кто остался в доме). Лестница и тамбур квартире
 * не нужны. Координаты откалиброваны по фонам assets/apartment/*.jpg
 * (1280×720); тюнинг — ?debugCollisions=1, ?debugPerspective=1.
 */

export const APT_BG = {
  kitchen: "bg-apt-kitchen",
  hallway: "bg-apt-hallway",
  landing: "bg-apt-landing",
  street: "bg-apt-street",
} as const;

export const APT_TEX = {
  sisterConfused: "npc-apt-sister-confused",
  sisterIdle: "npc-apt-sister-idle",
  sisterWalk: "npc-apt-sister-walk",
  firefighter: "npc-apt-firefighter",
  flame: "obj-apt-flame",
  panLid: "obj-apt-pan-lid",
  towels: "obj-apt-towels",
} as const;

// ------------------------------------------------------------------ кухня

/**
 * Кухня: холодильник и остров со стульями слева, плита со сковородой
 * у дальней стены, обеденный стол справа. Дверной проём — у правого края:
 * к нему обходят стол снизу.
 */
const kitchen: RoomLayout = {
  id: "classroom",
  backgroundKey: APT_BG.kitchen,
  walk: {
    yTop: 496,
    yBottom: 705,
    xTopMin: 450,
    xTopMax: 1050,
    xBottomMin: 300,
    xBottomMax: 1240,
  },
  perspective: {
    farY: 495,
    farAdultHeight: 280,
    nearY: 705,
    nearAdultHeight: 540,
  },
  playerRole: "teen",
  spawns: { start: { x: 610, y: 560 } },
  exits: [
    {
      id: "classroom_door",
      at: { x: 1165, y: 645 },
      radius: 100,
      labelKey: "game.interact.toCorridor",
      target: "corridor",
      spawn: "fromClassroom",
      telemetryEvent: "left_classroom",
    },
  ],
  autoExits: [],
  hotspots: [],
  props: [
    // Горящее масло: гаснет под крышкой или вспыхивает от воды.
    {
      textureKey: APT_TEX.flame,
      at: { x: 478, y: 357 },
      height: 95,
      fire: true,
      hideOnEvents: ["pan_covered", "pan_flared"],
    },
    {
      textureKey: APT_TEX.panLid,
      at: { x: 492, y: 366 },
      height: 44,
      showOnEvents: ["pan_covered", "pan_flared"],
      showDelayMs: 900,
    },
  ],
  npcs: [],
  fx: { dust: true },
  obstacles: [
    // остров со стульями
    { x: 60, y: 470, width: 420, height: 250 },
    // обеденный стол со стульями
    { x: 740, y: 500, width: 410, height: 170 },
  ],
};

// ---------------------------------------------------------------- коридор

/**
 * Прихожая: входная дверь в глубине (ручка справа), ванная справа,
 * балкон у правого края, тумба с телефоном и обувница слева.
 * После возвращения из подъезда здесь появляются полотенца, 101 и балкон.
 */
const hallway: RoomLayout = {
  id: "corridor",
  backgroundKey: APT_BG.hallway,
  walk: {
    yTop: 482,
    yBottom: 690,
    xTopMin: 485,
    xTopMax: 800,
    xBottomMin: 210,
    xBottomMax: 1045,
  },
  perspective: {
    farY: 478,
    farAdultHeight: 235,
    nearY: 705,
    nearAdultHeight: 520,
  },
  playerRole: "teen",
  spawns: {
    fromClassroom: { x: 740, y: 670 },
    fromLanding: { x: 640, y: 525 },
  },
  exits: [
    {
      id: "front_door",
      at: { x: 590, y: 494 },
      radius: 70,
      labelKey: "game.interact.openFrontDoor",
      target: "central_hall",
      spawn: "fromApartment",
      telemetryEvent: "opened_front_door",
      requiresNot: "returned_to_apartment",
      warnIfMissing: {
        event: "door_checked",
        riskEvent: "opened_door_unchecked",
      },
    },
    {
      id: "balcony_door",
      at: { x: 1010, y: 640 },
      radius: 95,
      labelKey: "game.interact.balcony",
      target: "outdoor",
      spawn: "fromBalcony",
      telemetryEvent: "went_to_balcony",
      scenarioEvent: "waited_on_balcony",
      requires: "returned_to_apartment",
      beat: { messageKey: "game.event.balconyWait", ms: 4000 },
    },
  ],
  autoExits: [],
  hotspots: [
    {
      id: "check_door",
      at: { x: 700, y: 492 },
      radius: 70,
      labelKey: "game.interact.checkDoor",
      scenarioEvent: "door_checked",
      once: true,
      requiresNot: "returned_to_apartment",
    },
    {
      id: "backpack",
      at: { x: 540, y: 628 },
      radius: 75,
      labelKey: "game.interact.takeBackpack",
      scenarioEvent: "backpack_note",
      once: true,
      requiresNot: "returned_to_apartment",
    },
    {
      id: "seal_door",
      at: { x: 640, y: 496 },
      radius: 95,
      labelKey: "game.interact.sealDoor",
      scenarioEvent: "sealed_door_gaps",
      once: true,
      requires: "returned_to_apartment",
    },
    {
      id: "call_rescue",
      at: { x: 440, y: 592 },
      radius: 90,
      labelKey: "game.interact.call101",
      scenarioEvent: "called_rescue",
      once: true,
      requires: "returned_to_apartment",
    },
  ],
  props: [
    {
      textureKey: OBJECT_TEX.backpack,
      at: { x: 540, y: 636 },
      height: 95,
      hideOnEvents: ["backpack_note"],
    },
    {
      textureKey: APT_TEX.towels,
      at: { x: 640, y: 478 },
      height: 52,
      showOnEvents: ["sealed_door_gaps"],
    },
  ],
  npcs: [
    {
      // Сестрёнка у двери в ванную — испугалась запаха гари.
      id: "confused_student",
      textureKey: APT_TEX.sisterConfused,
      at: { x: 880, y: 578 },
      role: "child",
      figureFill: 0.96,
      behavior: {
        kind: "confused",
        helpHotspotId: "help_student",
        followTexture: APT_TEX.sisterWalk,
      },
    },
  ],
  fx: {
    // Тонкая струйка дыма из-под входной двери.
    smoke: [
      {
        at: { x: 640, y: 470 },
        anim: FX_ANIM.smokeLight,
        scale: 0.3,
        alpha: 0.22,
        drift: 6,
      },
    ],
    dust: true,
  },
  objectiveKey: "game.objectiveCorridor",
  objectiveKeyAfter: [
    { event: "returned_to_apartment", key: "game.objectiveIsolate" },
  ],
  obstacles: [
    // обувница
    { x: 150, y: 560, width: 245, height: 150 },
    // тумба с лампой
    { x: 315, y: 520, width: 160, height: 55 },
  ],
};

// ----------------------------------------------------------------- подъезд

/**
 * Лестничная площадка: слева дверь соседей и лифт, в центре за перилами
 * лестница вниз — оттуда поднимается дым. Наша дверь справа: вернуться
 * домой — правильный выход (роль «запасного выхода» холла школы).
 */
const landing: RoomLayout = {
  id: "central_hall",
  backgroundKey: APT_BG.landing,
  walk: {
    yTop: 552,
    yBottom: 705,
    xTopMin: 190,
    xTopMax: 1045,
    xBottomMin: 40,
    xBottomMax: 1235,
  },
  perspective: {
    farY: 552,
    farAdultHeight: 265,
    nearY: 705,
    nearAdultHeight: 500,
  },
  playerRole: "teen",
  spawns: { fromApartment: { x: 1030, y: 650 } },
  exits: [
    {
      id: "side_exit_door",
      at: { x: 1110, y: 628 },
      radius: 105,
      labelKey: "game.interact.backHome",
      target: "corridor",
      spawn: "fromLanding",
      telemetryEvent: "returned_to_apartment",
      scenarioEvent: "returned_to_apartment",
    },
  ],
  autoExits: [],
  hotspots: [
    {
      id: "ask_teacher",
      at: { x: 420, y: 612 },
      radius: 90,
      labelKey: "game.interact.askTeacher",
      scenarioEvent: "ask_teacher_route",
      once: true,
    },
  ],
  props: [],
  npcs: [
    {
      // Сосед у лифта — взрослый-ориентир (роль учителя в холле школы).
      id: "teacher_hall",
      textureKey: MALL_NPC_TEX.manIdle,
      at: { x: 420, y: 612 },
      role: "adult",
      figureFill: 0.97,
      behavior: { kind: "idle_sway" },
    },
    {
      // Соседка идёт к лестнице, упирается в дым и возвращается домой.
      id: "hall_neighbor",
      textureKey: MALL_NPC_TEX.womanWalk,
      at: { x: 170, y: 640 },
      role: "adult",
      figureFill: 0.97,
      behavior: {
        kind: "redirect",
        toward: { x: 640, y: 582 },
        towardDuration: 3600,
        pauseMs: 900,
        then: { x: 120, y: 604 },
        thenDuration: 3200,
      },
    },
  ],
  fx: {
    smokeStages: {
      distant: {
        smoke: [
          {
            at: { x: 760, y: 470 },
            anim: FX_ANIM.smokeLight,
            scale: 0.45,
            alpha: 0.28,
            drift: 8,
          },
        ],
      },
      light: {
        smoke: [
          {
            at: { x: 700, y: 470 },
            anim: FX_ANIM.smokeLight,
            scale: 0.7,
            alpha: 0.42,
            drift: 10,
          },
          {
            at: { x: 810, y: 460 },
            anim: FX_ANIM.smokeLight,
            scale: 0.6,
            alpha: 0.38,
            drift: 10,
          },
        ],
      },
      medium: {
        smoke: [
          {
            at: { x: 720, y: 480 },
            anim: FX_ANIM.smokeMedium,
            scale: 0.9,
            alpha: 0.55,
            drift: 14,
          },
          {
            at: { x: 820, y: 470 },
            anim: FX_ANIM.smokeMedium,
            scale: 0.8,
            alpha: 0.5,
            drift: 12,
          },
        ],
        haze: {
          rect: { x: 520, y: 280, width: 420, height: 280 },
          textureKey: FX_TEX.hazeGray,
          alpha: 0.3,
        },
      },
      blocked: {
        smoke: [
          {
            at: { x: 730, y: 500 },
            anim: FX_ANIM.smokeHeavy,
            scale: 1.0,
            alpha: 0.7,
            drift: 16,
          },
          {
            at: { x: 820, y: 490 },
            anim: FX_ANIM.smokeHeavy,
            scale: 0.9,
            alpha: 0.65,
            drift: 14,
          },
        ],
        haze: {
          rect: { x: 500, y: 260, width: 460, height: 320 },
          textureKey: FX_TEX.hazeGray,
          alpha: 0.42,
        },
      },
    },
    dust: true,
  },
  smokeProgression: {
    lightAfterMs: 2200,
    mediumAfterMs: 6500,
    blockedAfterMs: 10500,
    approachRect: { x: 640, y: 552, width: 280, height: 90 },
  },
  /** Верх лестницы вниз: стоять здесь в дыму — главный риск квартиры. */
  dangerZone: {
    rect: { x: 690, y: 552, width: 200, height: 70 },
    lingerEvent: "route_blocked",
    lingerMs: 2500,
  },
  objectiveKey: "game.objectiveHall",
};

// ------------------------------------------------------------------- двор

/** Подъезд слева (туда не возвращаются), пожарный — перед машиной, жильцы правее. */
const street: RoomLayout = {
  id: "outdoor",
  backgroundKey: APT_BG.street,
  walk: {
    yTop: 455,
    yBottom: 705,
    xTopMin: 380,
    xTopMax: 1250,
    xBottomMin: 40,
    xBottomMax: 1250,
  },
  perspective: {
    farY: 455,
    farAdultHeight: 150,
    nearY: 705,
    nearAdultHeight: 370,
  },
  playerRole: "teen",
  spawns: { fromBalcony: { x: 700, y: 520 } },
  exits: [],
  autoExits: [],
  hotspots: [
    {
      id: "report_teacher",
      at: { x: 900, y: 552 },
      radius: 115,
      labelKey: "game.interact.reportTeacher",
      scenarioEvent: "reported_to_teacher",
      once: true,
    },
  ],
  props: [],
  npcs: [
    {
      id: "assembly_crowd",
      textureKey: MALL_NPC_TEX.groupAssembly,
      at: { x: 1165, y: 608 },
      role: "adult",
      figureFill: 0.95,
      behavior: { kind: "idle_sway" },
    },
    {
      id: "assembly_teacher",
      textureKey: APT_TEX.firefighter,
      at: { x: 900, y: 546 },
      role: "adult",
      figureFill: 0.97,
      flipX: true,
      behavior: { kind: "idle_sway" },
    },
  ],
  fx: {},
  objectiveKey: "game.objectiveAssembly",
};

export const APARTMENT_ROOM_LAYOUTS: Partial<Record<RoomId, RoomLayout>> = {
  classroom: kitchen,
  corridor: hallway,
  central_hall: landing,
  outdoor: street,
};
