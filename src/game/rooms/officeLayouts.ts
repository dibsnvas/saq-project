import { FX_ANIM, FX_TEX } from "../assets";
import { MALL_NPC_TEX } from "./mallLayouts";
import type { NpcRoute, Point, RoomId, RoomLayout } from "./types";

/**
 * Раскладки сценария «Пожар в офисе» — полный школьный маршрут ролей:
 * кабинет (старт) → коридор в дыму (пригнуться) → лифтовый холл
 * (развилка: лифт нельзя, лестница) → лестница → холл первого этажа →
 * двор с местом сбора. Взрослый-ориентир — ответственный за эвакуацию,
 * мама уходит из кабинета первой и ждёт на месте сбора.
 * Координаты откалиброваны по фонам assets/office/*.jpg (1280×720).
 */

export const OFFICE_BG = {
  room: "bg-office-room",
  corridor: "bg-office-corridor",
  liftHall: "bg-office-lift-hall",
  stairs: "bg-office-stairs",
  lobby: "bg-office-lobby",
  yard: "bg-office-yard",
} as const;

export const OFFICE_TEX = {
  momIdle: "npc-office-mom-idle",
  momWalk: "npc-office-mom-walk",
  wardenIdle: "npc-office-warden-idle",
  wardenWalk: "npc-office-warden-walk",
  groupEvacuating: "npc-office-group-evacuating",
  groupAssembly: "npc-office-group-assembly",
} as const;

// ----------------------------------------------------------------- кабинет

/**
 * Стеклянная дверь в коридор справа. Слева столы с планшетами и шкафы,
 * в глубине принтер, кулер и стол у окна; справа спереди стол с ноутбуком,
 * рядом на стуле рюкзак (вариант «собрать вещи»).
 */
const ROOM_DOOR: Point = { x: 1060, y: 522 };

const ROOM_ROUTES: Record<string, NpcRoute> = {
  momToExit: {
    id: "momToExit",
    waypoints: [{ x: 760, y: 482 }, { x: 950, y: 488 }, ROOM_DOOR],
  },
  backToExit: {
    id: "backToExit",
    waypoints: [{ x: 660, y: 470 }, { x: 900, y: 486 }, ROOM_DOOR],
  },
  centerToExit: {
    id: "centerToExit",
    waypoints: [
      { x: 700, y: 500 },
      { x: 930, y: 490 },
      { x: 1058, y: 526 },
    ],
  },
};

const room: RoomLayout = {
  id: "classroom",
  backgroundKey: OFFICE_BG.room,
  walk: {
    yTop: 432,
    yBottom: 705,
    xTopMin: 500,
    xTopMax: 1010,
    xBottomMin: 300,
    xBottomMax: 1180,
  },
  perspective: {
    farY: 430,
    farAdultHeight: 230,
    nearY: 705,
    nearAdultHeight: 440,
  },
  playerRole: "teen",
  spawns: { start: { x: 640, y: 610 } },
  exits: [
    {
      id: "classroom_door",
      at: ROOM_DOOR,
      radius: 110,
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
      at: { x: 930, y: 690 },
      radius: 100,
      labelKey: "game.interact.takeBackpack",
      scenarioEvent: "backpack_note",
      once: true,
    },
  ],
  props: [],
  npcs: [
    {
      // Мама уходит первой и ждёт на месте сбора.
      id: "teacher_class",
      textureKey: OFFICE_TEX.momIdle,
      at: { x: 650, y: 468 },
      role: "adult",
      figureFill: 0.97,
      behavior: { kind: "idle_sway" },
      evacuate: {
        delay: 2600,
        routeId: ROOM_ROUTES.momToExit.id,
        waypoints: ROOM_ROUTES.momToExit.waypoints,
        duration: 3000,
        walkTexture: OFFICE_TEX.momWalk,
      },
    },
    {
      id: "student_a",
      textureKey: MALL_NPC_TEX.manIdle,
      at: { x: 570, y: 448 },
      role: "adult",
      figureFill: 0.97,
      behavior: { kind: "idle_sway" },
      evacuate: {
        delay: 500,
        routeId: ROOM_ROUTES.backToExit.id,
        waypoints: ROOM_ROUTES.backToExit.waypoints,
        duration: 3800,
        walkTexture: MALL_NPC_TEX.manWalk,
      },
    },
    {
      id: "student_b",
      textureKey: MALL_NPC_TEX.womanIdle,
      at: { x: 600, y: 555 },
      role: "adult",
      figureFill: 0.97,
      behavior: { kind: "idle_sway" },
      evacuate: {
        delay: 1300,
        routeId: ROOM_ROUTES.centerToExit.id,
        waypoints: ROOM_ROUTES.centerToExit.waypoints,
        duration: 3600,
        walkTexture: MALL_NPC_TEX.womanWalk,
      },
    },
  ],
  fx: { alarm: true, dust: true },
  obstacles: [
    // столы с планшетами и шкафы слева
    { x: 0, y: 455, width: 495, height: 265 },
    // принтер и кулер
    { x: 390, y: 430, width: 170, height: 45 },
    // стол у окна
    { x: 705, y: 425, width: 160, height: 50 },
    // стол с ноутбуком и стул с рюкзаком
    { x: 795, y: 505, width: 330, height: 170 },
  ],
};

// ---------------------------------------------------------------- коридор

/**
 * Длинный коридор, в конце — лифтовый холл. Верх коридора в дыму:
 * на входе вопрос «пригнуться или идти в полный рост».
 */
const corridor: RoomLayout = {
  id: "corridor",
  backgroundKey: OFFICE_BG.corridor,
  walk: {
    yTop: 402,
    yBottom: 705,
    xTopMin: 592,
    xTopMax: 788,
    xBottomMin: 200,
    xBottomMax: 1150,
  },
  perspective: {
    farY: 402,
    farAdultHeight: 72,
    nearY: 705,
    nearAdultHeight: 460,
  },
  playerRole: "teen",
  spawns: { fromClassroom: { x: 960, y: 672 } },
  exits: [],
  autoExits: [
    {
      rect: { x: 600, y: 402, width: 180, height: 30 },
      target: "central_hall",
      spawn: "fromCorridor",
      telemetryEvent: "entered_central_hall",
    },
  ],
  hotspots: [],
  props: [],
  choiceZones: [
    {
      id: "smoke_corridor",
      rect: { x: 200, y: 578, width: 950, height: 36 },
      promptKey: "choice.smoke.prompt",
      options: [
        {
          id: "crouch",
          labelKey: "choice.smoke.crouch",
          event: "crouched_in_smoke",
          effect: "crouch",
        },
        {
          id: "upright",
          labelKey: "choice.smoke.upright",
          event: "walked_upright_in_smoke",
          effect: "upright",
        },
      ],
    },
  ],
  npcs: [
    {
      id: "evacuating_boy",
      textureKey: MALL_NPC_TEX.manWalk,
      at: { x: 760, y: 540 },
      role: "adult",
      figureFill: 0.97,
      behavior: {
        kind: "walker",
        to: { x: 700, y: 410 },
        duration: 6500,
        repeatDelay: 5500,
        fadeAtEnd: true,
      },
    },
    {
      id: "evacuating_girl",
      textureKey: MALL_NPC_TEX.womanWalk,
      at: { x: 620, y: 560 },
      role: "adult",
      figureFill: 0.97,
      behavior: {
        kind: "walker",
        to: { x: 670, y: 412 },
        duration: 7200,
        repeatDelay: 6000,
        fadeAtEnd: true,
      },
    },
    {
      // Посетительница растерялась: не знает, где лестница.
      id: "confused_student",
      textureKey: MALL_NPC_TEX.womanIdle,
      at: { x: 470, y: 520 },
      role: "adult",
      figureFill: 0.97,
      behavior: {
        kind: "confused",
        helpHotspotId: "help_student",
        followTexture: MALL_NPC_TEX.womanWalk,
      },
    },
    {
      id: "teacher_assessing",
      textureKey: OFFICE_TEX.wardenIdle,
      at: { x: 330, y: 660 },
      role: "adult",
      figureFill: 0.97,
      behavior: { kind: "idle_sway" },
    },
  ],
  fx: {
    // Дым стелется под потолком, у пола воздух чище.
    smoke: [
      {
        at: { x: 420, y: 170 },
        anim: FX_ANIM.smokeMedium,
        scale: 0.9,
        alpha: 0.45,
        drift: 12,
      },
      {
        at: { x: 880, y: 160 },
        anim: FX_ANIM.smokeMedium,
        scale: 0.9,
        alpha: 0.45,
        drift: 12,
      },
      {
        at: { x: 660, y: 250 },
        anim: FX_ANIM.smokeLight,
        scale: 0.7,
        alpha: 0.4,
        drift: 10,
      },
    ],
    haze: {
      rect: { x: 0, y: 0, width: 1280, height: 330 },
      textureKey: FX_TEX.hazeGray,
      alpha: 0.4,
    },
    alarm: true,
    dust: true,
  },
  objectiveKey: "game.objectiveCorridor",
};

// ----------------------------------------------------------- лифтовый холл

/**
 * Развилка: лифты с открытыми дверями по центру в глубине — привычный путь,
 * но из шахты тянет дым. Дверь на лестницу со знаком «Выход» справа,
 * план эвакуации на правой стене. Ресепшен и диван слева — препятствия.
 */
const liftHall: RoomLayout = {
  id: "central_hall",
  backgroundKey: OFFICE_BG.liftHall,
  walk: {
    yTop: 442,
    yBottom: 705,
    xTopMin: 300,
    xTopMax: 900,
    xBottomMin: 30,
    xBottomMax: 1130,
  },
  perspective: {
    farY: 442,
    farAdultHeight: 115,
    nearY: 705,
    nearAdultHeight: 400,
  },
  playerRole: "teen",
  spawns: { fromCorridor: { x: 200, y: 660 } },
  exits: [
    {
      id: "side_exit_door",
      at: { x: 1005, y: 588 },
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
      at: { x: 1090, y: 610 },
      radius: 100,
      labelKey: "game.interact.viewPlan",
      scenarioEvent: "evacuation_plan_checked",
      once: true,
    },
    {
      id: "safe_exit_sign",
      at: { x: 925, y: 520 },
      radius: 85,
      labelKey: "game.interact.checkExitSign",
      scenarioEvent: "safe_exit_sign_detected",
      once: true,
    },
    {
      id: "ask_teacher",
      at: { x: 820, y: 602 },
      radius: 90,
      labelKey: "game.interact.askTeacher",
      scenarioEvent: "ask_teacher_route",
      once: true,
    },
  ],
  props: [],
  obstacles: [
    // ресепшен
    { x: 0, y: 470, width: 290, height: 110 },
    // диван и столик
    { x: 280, y: 420, width: 240, height: 60 },
  ],
  npcs: [
    {
      id: "teacher_hall",
      textureKey: OFFICE_TEX.wardenIdle,
      at: { x: 820, y: 602 },
      role: "adult",
      figureFill: 0.97,
      behavior: { kind: "idle_sway" },
    },
    {
      id: "hall_group",
      textureKey: OFFICE_TEX.groupEvacuating,
      at: { x: 520, y: 630 },
      role: "adult",
      figureFill: 0.95,
      behavior: {
        kind: "redirect",
        toward: { x: 690, y: 480 },
        towardDuration: 4200,
        pauseMs: 900,
        then: { x: 975, y: 585 },
        thenDuration: 3800,
      },
    },
    {
      id: "hall_pair",
      textureKey: MALL_NPC_TEX.pairWalking,
      at: { x: 400, y: 668 },
      role: "adult",
      figureFill: 0.97,
      behavior: {
        kind: "redirect",
        toward: { x: 610, y: 500 },
        towardDuration: 5200,
        pauseMs: 1100,
        then: { x: 950, y: 625 },
        thenDuration: 4200,
      },
    },
    {
      id: "hall_girl",
      textureKey: MALL_NPC_TEX.womanIdle,
      at: { x: 640, y: 640 },
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
            at: { x: 690, y: 360 },
            anim: FX_ANIM.smokeLight,
            scale: 0.5,
            alpha: 0.3,
            drift: 8,
          },
        ],
      },
      light: {
        smoke: [
          {
            at: { x: 640, y: 370 },
            anim: FX_ANIM.smokeLight,
            scale: 0.75,
            alpha: 0.45,
            drift: 12,
          },
          {
            at: { x: 750, y: 365 },
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
            at: { x: 660, y: 390 },
            anim: FX_ANIM.smokeMedium,
            scale: 0.9,
            alpha: 0.55,
            drift: 14,
          },
          {
            at: { x: 760, y: 385 },
            anim: FX_ANIM.smokeMedium,
            scale: 0.8,
            alpha: 0.5,
            drift: 12,
          },
        ],
        haze: {
          rect: { x: 470, y: 250, width: 400, height: 220 },
          textureKey: FX_TEX.hazeGray,
          alpha: 0.28,
        },
      },
      blocked: {
        smoke: [
          {
            at: { x: 650, y: 410 },
            anim: FX_ANIM.smokeHeavy,
            scale: 1.0,
            alpha: 0.7,
            drift: 16,
          },
          {
            at: { x: 750, y: 405 },
            anim: FX_ANIM.smokeHeavy,
            scale: 0.9,
            alpha: 0.65,
            drift: 14,
          },
        ],
        haze: {
          rect: { x: 460, y: 240, width: 420, height: 250 },
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
    approachRect: { x: 560, y: 442, width: 280, height: 100 },
  },
  /** Лифты: стоять у открытых дверей в дыму — главный риск офиса. */
  dangerZone: {
    rect: { x: 580, y: 442, width: 240, height: 80 },
    lingerEvent: "route_blocked",
    lingerMs: 2500,
  },
  objectiveKey: "game.objectiveHall",
};

// ---------------------------------------------------------------- лестница

/** Эвакуационная лестница: ракурс как у ТРЦ, толпа в центре, свободный проход справа. */
const stairs: RoomLayout = {
  id: "stairs",
  backgroundKey: OFFICE_BG.stairs,
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
      textureKey: OFFICE_TEX.groupEvacuating,
      at: { x: 555, y: 650 },
      role: "adult",
      figureFill: 0.95,
      behavior: { kind: "idle_sway" },
    },
    {
      id: "teacher_descending",
      textureKey: OFFICE_TEX.wardenWalk,
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

// --------------------------------------------------- холл первого этажа

const lobby: RoomLayout = {
  id: "vestibule",
  backgroundKey: OFFICE_BG.lobby,
  walk: {
    yTop: 592,
    yBottom: 705,
    xTopMin: 360,
    xTopMax: 900,
    xBottomMin: 330,
    xBottomMax: 990,
  },
  perspective: {
    farY: 590,
    farAdultHeight: 290,
    nearY: 705,
    nearAdultHeight: 390,
  },
  playerRole: "teen",
  spawns: { fromStairs: { x: 430, y: 690 } },
  exits: [],
  autoExits: [
    {
      rect: { x: 490, y: 592, width: 290, height: 30 },
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
      at: { x: 470, y: 700 },
      role: "adult",
      figureFill: 0.97,
      behavior: {
        kind: "walker",
        to: { x: 630, y: 604 },
        duration: 4200,
        repeatDelay: 12000,
        fadeAtEnd: true,
      },
    },
  ],
  fx: { dust: true },
  objectiveKey: "game.objectiveVestibule",
};

// -------------------------------------------------------------------- двор

/** Вход в офис слева (у дверей работают пожарные), место сбора — у знака справа. */
const yard: RoomLayout = {
  id: "outdoor",
  backgroundKey: OFFICE_BG.yard,
  walk: {
    yTop: 470,
    yBottom: 705,
    xTopMin: 300,
    xTopMax: 1250,
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
  spawns: { fromVestibule: { x: 380, y: 585 } },
  exits: [],
  autoExits: [],
  hotspots: [
    {
      id: "report_teacher",
      at: { x: 960, y: 552 },
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
      textureKey: OFFICE_TEX.groupAssembly,
      at: { x: 1170, y: 606 },
      role: "adult",
      figureFill: 0.95,
      behavior: { kind: "idle_sway" },
    },
    {
      // Мама уже на месте сбора.
      id: "assembly_boy",
      textureKey: OFFICE_TEX.momIdle,
      at: { x: 865, y: 606 },
      role: "adult",
      figureFill: 0.97,
      behavior: { kind: "idle_sway" },
    },
    {
      id: "assembly_teacher",
      textureKey: OFFICE_TEX.wardenIdle,
      at: { x: 960, y: 546 },
      role: "adult",
      figureFill: 0.97,
      flipX: true,
      behavior: { kind: "idle_sway" },
    },
  ],
  fx: {},
  objectiveKey: "game.objectiveAssembly",
};

export const OFFICE_ROOM_LAYOUTS: Record<RoomId, RoomLayout> = {
  classroom: room,
  corridor,
  central_hall: liftHall,
  stairs,
  vestibule: lobby,
  outdoor: yard,
};
