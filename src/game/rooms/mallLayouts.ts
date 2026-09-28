import { FX_ANIM, FX_TEX, OBJECT_TEX } from "../assets";
import type { NpcRoute, Point, RoomId, RoomLayout } from "./types";

/**
 * Раскладки сценария «Пожар в ТРЦ». Комнаты — те же роли, что в школе,
 * поэтому игровая логика и оценка общие:
 * магазин (старт) → галерея (коридор) → атриум (холл-развилка) →
 * эвакуационная лестница → выход → парковка с точкой сбора.
 * Координаты откалиброваны по фонам assets/mall/*.jpg (1280×720);
 * тюнинг — ?debugCollisions=1, ?debugPerspective=1, ?debugNpcPaths=1.
 */

export const MALL_BG = {
  shop: "bg-mall-shop",
  gallery: "bg-mall-gallery",
  atrium: "bg-mall-atrium",
  stairs: "bg-mall-stairs",
  vestibule: "bg-mall-vestibule",
  outdoor: "bg-mall-outdoor",
} as const;

export const MALL_NPC_TEX = {
  guardIdle: "npc-mall-guard-idle",
  guardWalk: "npc-mall-guard-walk",
  manIdle: "npc-mall-man-idle",
  manWalk: "npc-mall-man-walk",
  womanIdle: "npc-mall-woman-idle",
  womanWalk: "npc-mall-woman-walk",
  childConfused: "npc-mall-child-confused",
  childIdle: "npc-mall-child-idle",
  childWalk: "npc-mall-child-walk",
  groupEvacuating: "npc-mall-group-evacuating",
  groupAssembly: "npc-mall-group-assembly",
  pairWalking: "npc-mall-pair-walking",
} as const;

// ---------------------------------------------------------------- магазин

/** Стеклянный вход в галерею — справа; центральный проход свободен. */
const SHOP_DOOR: Point = { x: 1110, y: 502 };

export const SHOP_ROUTES: Record<string, NpcRoute> = {
  guardToExit: {
    id: "guardToExit",
    waypoints: [{ x: 900, y: 470 }, { x: 1040, y: 488 }, SHOP_DOOR],
  },
  backLeftToExit: {
    id: "backLeftToExit",
    waypoints: [{ x: 620, y: 478 }, { x: 900, y: 480 }, SHOP_DOOR],
  },
  centerToExit: {
    id: "centerToExit",
    waypoints: [
      { x: 720, y: 500 },
      { x: 950, y: 488 },
      { x: 1108, y: 506 },
    ],
  },
  nearToExit: {
    id: "nearToExit",
    waypoints: [
      { x: 770, y: 505 },
      { x: 1000, y: 492 },
      { x: 1112, y: 508 },
    ],
  },
};

const shop: RoomLayout = {
  id: "classroom",
  backgroundKey: MALL_BG.shop,
  walk: {
    yTop: 450,
    yBottom: 705,
    xTopMin: 520,
    xTopMax: 1200,
    xBottomMin: 300,
    xBottomMax: 1250,
  },
  perspective: {
    farY: 440,
    farAdultHeight: 150,
    nearY: 705,
    nearAdultHeight: 350,
  },
  playerRole: "teen",
  spawns: { start: { x: 640, y: 640 } },
  exits: [
    {
      id: "classroom_door",
      at: SHOP_DOOR,
      radius: 120,
      labelKey: "game.interact.toCorridor",
      target: "corridor",
      spawn: "fromClassroom",
      telemetryEvent: "left_classroom",
    },
  ],
  autoExits: [],
  hotspots: [
    {
      id: "backpack",
      at: { x: 560, y: 606 },
      radius: 80,
      labelKey: "game.interact.takeBackpack",
      scenarioEvent: "backpack_note",
      once: true,
    },
  ],
  props: [
    { textureKey: OBJECT_TEX.backpack, at: { x: 560, y: 614 }, height: 70 },
  ],
  npcs: [
    {
      id: "teacher_class",
      textureKey: MALL_NPC_TEX.guardIdle,
      at: { x: 820, y: 458 },
      role: "adult",
      figureFill: 0.97,
      behavior: { kind: "idle_sway" },
      evacuate: {
        delay: 3200,
        routeId: SHOP_ROUTES.guardToExit.id,
        waypoints: SHOP_ROUTES.guardToExit.waypoints,
        duration: 3000,
        walkTexture: MALL_NPC_TEX.guardWalk,
      },
    },
    {
      id: "student_a",
      textureKey: MALL_NPC_TEX.manIdle,
      at: { x: 580, y: 470 },
      role: "adult",
      figureFill: 0.97,
      behavior: { kind: "idle_sway" },
      evacuate: {
        delay: 500,
        routeId: SHOP_ROUTES.backLeftToExit.id,
        waypoints: SHOP_ROUTES.backLeftToExit.waypoints,
        duration: 3800,
        walkTexture: MALL_NPC_TEX.manWalk,
      },
    },
    {
      id: "student_b",
      textureKey: MALL_NPC_TEX.womanIdle,
      at: { x: 700, y: 560 },
      role: "adult",
      figureFill: 0.97,
      behavior: { kind: "idle_sway" },
      evacuate: {
        delay: 1100,
        routeId: SHOP_ROUTES.centerToExit.id,
        waypoints: SHOP_ROUTES.centerToExit.waypoints,
        duration: 3600,
        walkTexture: MALL_NPC_TEX.womanWalk,
      },
    },
    {
      id: "student_c",
      textureKey: MALL_NPC_TEX.womanIdle,
      at: { x: 760, y: 650 },
      role: "adult",
      figureFill: 0.97,
      flipX: true,
      behavior: { kind: "idle_sway" },
      evacuate: {
        delay: 1900,
        routeId: SHOP_ROUTES.nearToExit.id,
        waypoints: SHOP_ROUTES.nearToExit.waypoints,
        duration: 4000,
        walkTexture: MALL_NPC_TEX.womanWalk,
      },
    },
  ],
  fx: { dust: true },
  /** Столы с одеждой — по ним не ходят; проход между ними свободен. */
  obstacles: [
    { x: 0, y: 490, width: 495, height: 230 },
    { x: 785, y: 520, width: 380, height: 200 },
  ],
};

// ---------------------------------------------------------------- галерея

const gallery: RoomLayout = {
  id: "corridor",
  backgroundKey: MALL_BG.gallery,
  walk: {
    yTop: 415,
    yBottom: 705,
    xTopMin: 600,
    xTopMax: 790,
    xBottomMin: 170,
    xBottomMax: 1190,
  },
  perspective: {
    farY: 415,
    farAdultHeight: 120,
    nearY: 705,
    nearAdultHeight: 390,
  },
  playerRole: "teen",
  spawns: { fromClassroom: { x: 1000, y: 660 } },
  exits: [],
  /** Дальний конец галереи открывается в атриум. */
  autoExits: [
    {
      rect: { x: 600, y: 415, width: 190, height: 45 },
      target: "central_hall",
      spawn: "fromCorridor",
      telemetryEvent: "entered_central_hall",
    },
  ],
  hotspots: [],
  props: [],
  npcs: [
    {
      id: "evacuating_boy",
      textureKey: MALL_NPC_TEX.manWalk,
      at: { x: 760, y: 560 },
      role: "adult",
      figureFill: 0.97,
      behavior: {
        kind: "walker",
        to: { x: 705, y: 425 },
        duration: 6500,
        repeatDelay: 5500,
        fadeAtEnd: true,
      },
    },
    {
      id: "evacuating_girl",
      textureKey: MALL_NPC_TEX.womanWalk,
      at: { x: 640, y: 585 },
      role: "adult",
      figureFill: 0.97,
      behavior: {
        kind: "walker",
        to: { x: 680, y: 430 },
        duration: 7200,
        repeatDelay: 6000,
        fadeAtEnd: true,
      },
    },
    {
      // Потерявшийся ребёнок у витрины книжного.
      id: "confused_student",
      textureKey: MALL_NPC_TEX.childConfused,
      at: { x: 905, y: 575 },
      role: "child",
      figureFill: 0.96,
      behavior: {
        kind: "confused",
        helpHotspotId: "help_student",
        followTexture: MALL_NPC_TEX.childWalk,
      },
    },
    {
      id: "teacher_assessing",
      textureKey: MALL_NPC_TEX.guardIdle,
      at: { x: 330, y: 640 },
      role: "adult",
      figureFill: 0.97,
      behavior: { kind: "idle_sway" },
    },
  ],
  fx: {
    smoke: [
      {
        at: { x: 695, y: 340 },
        anim: FX_ANIM.smokeLight,
        scale: 0.42,
        alpha: 0.18,
        drift: 8,
      },
    ],
    alarm: true,
    dust: true,
  },
  objectiveKey: "game.objectiveCorridor",
};

// ----------------------------------------------------------------- атриум

/**
 * Атриум — развилка. Главный вход (вращающиеся двери) — по центру в глубине:
 * туда идёт поток и туда же приходит дым. Запасной выход — справа, знак
 * «Выход» над ним, план эвакуации на правой стене. Эскалаторы и фонтан
 * слева — препятствия.
 */
const atrium: RoomLayout = {
  id: "central_hall",
  backgroundKey: MALL_BG.atrium,
  walk: {
    yTop: 445,
    yBottom: 705,
    xTopMin: 520,
    xTopMax: 1060,
    xBottomMin: 60,
    xBottomMax: 1230,
  },
  perspective: {
    farY: 445,
    farAdultHeight: 125,
    nearY: 705,
    nearAdultHeight: 385,
  },
  playerRole: "teen",
  spawns: { fromCorridor: { x: 200, y: 655 } },
  exits: [
    {
      id: "side_exit_door",
      at: { x: 1010, y: 495 },
      radius: 100,
      labelKey: "game.interact.emergencyExit",
      target: "stairs",
      spawn: "fromCentralHall",
      telemetryEvent: "used_emergency_exit",
    },
  ],
  autoExits: [],
  hotspots: [
    {
      id: "evacuation_plan",
      at: { x: 1130, y: 600 },
      radius: 95,
      labelKey: "game.interact.viewPlan",
      scenarioEvent: "evacuation_plan_checked",
      once: true,
    },
    {
      id: "safe_exit_sign",
      at: { x: 945, y: 505 },
      radius: 85,
      labelKey: "game.interact.checkExitSign",
      scenarioEvent: "safe_exit_sign_detected",
      once: true,
    },
    {
      id: "ask_teacher",
      at: { x: 860, y: 575 },
      radius: 90,
      labelKey: "game.interact.askTeacher",
      scenarioEvent: "ask_teacher_route",
      once: true,
    },
  ],
  props: [],
  obstacles: [
    // эскалаторы
    { x: 0, y: 440, width: 300, height: 140 },
    // фонтан с клумбой
    { x: 285, y: 445, width: 340, height: 95 },
  ],
  npcs: [
    {
      id: "teacher_hall",
      textureKey: MALL_NPC_TEX.guardIdle,
      at: { x: 860, y: 575 },
      role: "adult",
      figureFill: 0.97,
      behavior: { kind: "idle_sway" },
    },
    {
      id: "hall_group",
      textureKey: MALL_NPC_TEX.groupEvacuating,
      at: { x: 560, y: 625 },
      role: "adult",
      figureFill: 0.95,
      behavior: {
        kind: "redirect",
        toward: { x: 690, y: 500 },
        towardDuration: 4200,
        pauseMs: 900,
        then: { x: 960, y: 565 },
        thenDuration: 3800,
      },
    },
    {
      id: "hall_pair",
      textureKey: MALL_NPC_TEX.pairWalking,
      at: { x: 430, y: 665 },
      role: "adult",
      figureFill: 0.97,
      behavior: {
        kind: "redirect",
        toward: { x: 620, y: 520 },
        towardDuration: 5200,
        pauseMs: 1100,
        then: { x: 930, y: 605 },
        thenDuration: 4200,
      },
    },
    {
      id: "hall_girl",
      textureKey: MALL_NPC_TEX.womanIdle,
      at: { x: 720, y: 615 },
      role: "adult",
      figureFill: 0.97,
      behavior: { kind: "idle_sway" },
    },
  ],
  fx: {
    smokeStages: {
      distant: {
        smoke: [
          {
            at: { x: 690, y: 330 },
            anim: FX_ANIM.smokeLight,
            scale: 0.55,
            alpha: 0.3,
            drift: 8,
          },
        ],
      },
      light: {
        smoke: [
          {
            at: { x: 640, y: 345 },
            anim: FX_ANIM.smokeLight,
            scale: 0.8,
            alpha: 0.45,
            drift: 12,
          },
          {
            at: { x: 750, y: 340 },
            anim: FX_ANIM.smokeLight,
            scale: 0.7,
            alpha: 0.4,
            drift: 10,
          },
        ],
      },
      medium: {
        smoke: [
          {
            at: { x: 670, y: 370 },
            anim: FX_ANIM.smokeMedium,
            scale: 0.9,
            alpha: 0.55,
            drift: 14,
          },
          {
            at: { x: 760, y: 365 },
            anim: FX_ANIM.smokeMedium,
            scale: 0.8,
            alpha: 0.5,
            drift: 12,
          },
        ],
        haze: {
          rect: { x: 520, y: 250, width: 340, height: 200 },
          textureKey: FX_TEX.hazeGray,
          alpha: 0.28,
        },
      },
      blocked: {
        smoke: [
          {
            at: { x: 660, y: 390 },
            anim: FX_ANIM.smokeHeavy,
            scale: 1.0,
            alpha: 0.7,
            drift: 16,
          },
          {
            at: { x: 740, y: 385 },
            anim: FX_ANIM.smokeHeavy,
            scale: 0.9,
            alpha: 0.65,
            drift: 14,
          },
        ],
        haze: {
          rect: { x: 510, y: 240, width: 360, height: 230 },
          textureKey: FX_TEX.hazeGray,
          alpha: 0.4,
        },
      },
    },
    alarm: true,
    dust: true,
  },
  smokeProgression: {
    lightAfterMs: 2600,
    mediumAfterMs: 7500,
    blockedAfterMs: 11500,
    approachRect: { x: 540, y: 445, width: 300, height: 100 },
  },
  dangerZone: {
    rect: { x: 560, y: 445, width: 260, height: 90 },
    lingerEvent: "route_blocked",
    lingerMs: 2500,
  },
  objectiveKey: "game.objectiveHall",
};

// ---------------------------------------------------------------- лестница

/** Площадка неглубокая, камера близко. Толпа в центре, спокойный проход снизу справа. */
const stairs: RoomLayout = {
  id: "stairs",
  backgroundKey: MALL_BG.stairs,
  walk: {
    yTop: 598,
    yBottom: 706,
    xTopMin: 250,
    xTopMax: 1190,
    xBottomMin: 110,
    xBottomMax: 1260,
  },
  perspective: {
    farY: 598,
    farAdultHeight: 320,
    nearY: 706,
    nearAdultHeight: 400,
  },
  playerRole: "teen",
  spawns: { fromCentralHall: { x: 1140, y: 660 } },
  exits: [],
  autoExits: [
    {
      rect: { x: 300, y: 684, width: 300, height: 32 },
      target: "vestibule",
      spawn: "fromStairs",
      telemetryEvent: "descended_stairs",
    },
  ],
  hotspots: [],
  props: [],
  slowZones: [
    { rect: { x: 420, y: 606, width: 270, height: 66 }, factor: 0.52 },
  ],
  calmLane: { x: 760, y: 664, width: 360, height: 40 },
  npcs: [
    {
      id: "landing_group",
      textureKey: MALL_NPC_TEX.groupEvacuating,
      at: { x: 555, y: 650 },
      role: "adult",
      figureFill: 0.95,
      behavior: { kind: "idle_sway" },
    },
    {
      id: "teacher_descending",
      textureKey: MALL_NPC_TEX.guardWalk,
      at: { x: 1000, y: 612 },
      role: "adult",
      figureFill: 0.97,
      flipX: true,
      behavior: {
        kind: "walker",
        to: { x: 700, y: 700 },
        duration: 6500,
        repeatDelay: 8500,
        fadeAtEnd: true,
      },
    },
    {
      id: "students_pair",
      textureKey: MALL_NPC_TEX.pairWalking,
      at: { x: 280, y: 640 },
      role: "adult",
      figureFill: 0.97,
      behavior: {
        kind: "walker",
        to: { x: 560, y: 705 },
        duration: 5200,
        repeatDelay: 11000,
        fadeAtEnd: true,
      },
    },
  ],
  fx: { alarm: true, dust: true },
  objectiveKey: "game.objectiveStairs",
};

// ------------------------------------------------------------------ выход

const vestibule: RoomLayout = {
  id: "vestibule",
  backgroundKey: MALL_BG.vestibule,
  walk: {
    yTop: 590,
    yBottom: 705,
    xTopMin: 380,
    xTopMax: 900,
    xBottomMin: 130,
    xBottomMax: 1150,
  },
  perspective: {
    farY: 590,
    farAdultHeight: 290,
    nearY: 705,
    nearAdultHeight: 390,
  },
  playerRole: "teen",
  spawns: { fromStairs: { x: 240, y: 680 } },
  exits: [],
  autoExits: [
    {
      rect: { x: 505, y: 590, width: 260, height: 34 },
      target: "outdoor",
      spawn: "fromVestibule",
      telemetryEvent: "exited_building",
    },
  ],
  hotspots: [],
  props: [],
  npcs: [
    {
      id: "vestibule_pair",
      textureKey: MALL_NPC_TEX.pairWalking,
      at: { x: 320, y: 700 },
      role: "adult",
      figureFill: 0.97,
      behavior: {
        kind: "walker",
        to: { x: 630, y: 612 },
        duration: 4200,
        repeatDelay: 12000,
        fadeAtEnd: true,
      },
    },
  ],
  fx: { dust: true },
  objectiveKey: "game.objectiveVestibule",
};

// ---------------------------------------------------------------- парковка

/** Двери ТРЦ слева (туда не возвращаются), точка сбора — у знака справа. */
const outdoor: RoomLayout = {
  id: "outdoor",
  backgroundKey: MALL_BG.outdoor,
  walk: {
    yTop: 465,
    yBottom: 705,
    xTopMin: 430,
    xTopMax: 1260,
    xBottomMin: 40,
    xBottomMax: 1250,
  },
  perspective: {
    farY: 465,
    farAdultHeight: 150,
    nearY: 705,
    nearAdultHeight: 360,
  },
  playerRole: "teen",
  spawns: { fromVestibule: { x: 380, y: 580 } },
  exits: [],
  autoExits: [],
  hotspots: [
    {
      id: "report_teacher",
      at: { x: 915, y: 548 },
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
      at: { x: 1185, y: 600 },
      role: "adult",
      figureFill: 0.95,
      behavior: { kind: "idle_sway" },
    },
    {
      id: "assembly_boy",
      textureKey: MALL_NPC_TEX.manIdle,
      at: { x: 770, y: 612 },
      role: "adult",
      figureFill: 0.97,
      behavior: { kind: "idle_sway" },
    },
    {
      id: "assembly_teacher",
      textureKey: MALL_NPC_TEX.guardIdle,
      at: { x: 915, y: 546 },
      role: "adult",
      figureFill: 0.97,
      flipX: true,
      behavior: { kind: "idle_sway" },
    },
  ],
  fx: {},
  objectiveKey: "game.objectiveAssembly",
};

export const MALL_ROOM_LAYOUTS: Record<RoomId, RoomLayout> = {
  classroom: shop,
  corridor: gallery,
  central_hall: atrium,
  stairs,
  vestibule,
  outdoor,
};
