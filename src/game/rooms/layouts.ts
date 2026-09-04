import { BG, FX_ANIM, FX_TEX, NPC_TEX, OBJECT_TEX } from "../assets";
import type { NpcRoute, Point, RoomId, RoomLayout } from "./types";

/**
 * Раскладки комнат сценария «Пожар в школе».
 * Маршрут: classroom → corridor (у класса) → central_hall (decision room)
 * → stairs (запасной маршрут) → vestibule → outdoor.
 * Масштаб — perspective-якоря (калибровка под двери/парты/перила).
 */

// ---------------------------------------------------------------- classroom

/**
 * Переиспользуемые waypoint-маршруты эвакуации класса. Свободные полосы
 * (по obstacles, тюнинг ?debugCollisions=1):
 *  - верхний коридор y≈500–545 (над партами, ведёт к двери);
 *  - центральный проход x≈510–785;
 *  - межрядная полоса y≈602–643.
 * Каждый маршрут: выход из-за парты → проход → поворот к двери. Прямых
 * отрезков через парты нет (?debugNpcPaths=1 для визуальной проверки).
 */
const CLASSROOM_DOOR: Point = { x: 1120, y: 530 };

export const CLASSROOM_ROUTES: Record<string, NpcRoute> = {
  teacherToExit: {
    id: "teacherToExit",
    // Учитель уже в верхнем проходе (y≈502); идёт вдоль него к двери.
    waypoints: [
      { x: 780, y: 518 },
      { x: 980, y: 522 },
      { x: 1120, y: 524 },
    ],
  },
  /**
   * Левый средний ряд: сначала в центральный проход (x>510 — мимо парты),
   * затем вверх в верхний коридор и к двери. Прямой подъём при x=468
   * резал бы прямоугольник парты.
   */
  leftRowToExit: {
    id: "leftRowToExit",
    // Сначала строго вправо в центральный проход (парта кончается на x≈510),
    // и только потом вверх — иначе сегмент режет obstacle-прямоугольник.
    waypoints: [
      { x: 535, y: 560 },
      { x: 535, y: 528 },
      { x: 820, y: 526 },
      CLASSROOM_DOOR,
    ],
  },
  /** Межрядная полоса → центральный проход → верхний коридор → дверь */
  centerAisleToExit: {
    id: "centerAisleToExit",
    waypoints: [
      { x: 640, y: 618 },
      { x: 640, y: 535 },
      { x: 900, y: 532 },
      { x: 1122, y: 535 },
    ],
  },
  /** Правый ряд: в центральный проход, вверх, к двери (чуть правее оси) */
  rightRowToExit: {
    id: "rightRowToExit",
    waypoints: [
      { x: 720, y: 575 },
      { x: 720, y: 528 },
      { x: 960, y: 530 },
      CLASSROOM_DOOR,
    ],
  },
  /** Ближний правый ученик: сначала по межрядной полосе, затем вверх */
  rightNearToExit: {
    id: "rightNearToExit",
    waypoints: [
      { x: 700, y: 625 },
      { x: 700, y: 532 },
      { x: 1000, y: 534 },
      { x: 1120, y: 534 },
    ],
  },
};

const classroom: RoomLayout = {
  id: "classroom",
  backgroundKey: BG.classroom,
  walk: {
    // yTop лежит в «коридоре» между верхним и средним рядами парт:
    // верхняя граница пола сама ведёт игрока к двери без застреваний.
    yTop: 500,
    yBottom: 700,
    xTopMin: 440,
    xTopMax: 1165,
    xBottomMin: 150,
    xBottomMax: 1180,
  },
  // Near teen ≈ 270–300 px; mid ≈ 200; far ≈ 120–140.
  perspective: {
    farY: 480,
    farAdultHeight: 155,
    nearY: 700,
    nearAdultHeight: 340,
  },
  playerRole: "teen",
  spawns: {
    start: { x: 620, y: 645 },
  },
  exits: [
    {
      id: "classroom_door",
      at: { x: 1140, y: 522 },
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
      at: { x: 492, y: 632 },
      radius: 80,
      labelKey: "game.interact.takeBackpack",
      scenarioEvent: "backpack_note",
      once: true,
    },
  ],
  props: [
    {
      textureKey: OBJECT_TEX.backpack,
      at: { x: 492, y: 636 },
      height: 78,
    },
  ],
  /**
   * Полный класс после видео: учительница у доски и ученики у парт.
   * После первого решения уходят по waypoint-маршрутам (не сквозь парты).
   */
  npcs: [
    {
      id: "teacher_class",
      textureKey: NPC_TEX.teacherIdle,
      at: { x: 700, y: 502 },
      role: "adult",
      figureFill: 0.97,
      behavior: { kind: "idle_sway" },
      evacuate: {
        delay: 3200,
        routeId: CLASSROOM_ROUTES.teacherToExit.id,
        waypoints: CLASSROOM_ROUTES.teacherToExit.waypoints,
        duration: 3600,
        walkTexture: NPC_TEX.teacherWalk,
      },
    },
    {
      id: "student_a",
      textureKey: NPC_TEX.boyIdle,
      at: { x: 468, y: 560 },
      role: "teen",
      figureFill: 0.96,
      behavior: { kind: "idle_sway" },
      evacuate: {
        delay: 500,
        routeId: CLASSROOM_ROUTES.leftRowToExit.id,
        waypoints: CLASSROOM_ROUTES.leftRowToExit.waypoints,
        duration: 3800,
        walkTexture: NPC_TEX.boyWalk,
      },
    },
    {
      id: "student_b",
      textureKey: NPC_TEX.girlIdle,
      at: { x: 770, y: 575 },
      role: "teen",
      figureFill: 0.96,
      behavior: { kind: "idle_sway" },
      evacuate: {
        delay: 1100,
        routeId: CLASSROOM_ROUTES.rightRowToExit.id,
        waypoints: CLASSROOM_ROUTES.rightRowToExit.waypoints,
        duration: 3400,
        walkTexture: NPC_TEX.girlWalk,
      },
    },
    {
      id: "student_c",
      textureKey: NPC_TEX.boyIdle,
      at: { x: 788, y: 632 },
      role: "teen",
      figureFill: 0.96,
      flipX: true,
      behavior: { kind: "idle_sway" },
      evacuate: {
        delay: 1800,
        routeId: CLASSROOM_ROUTES.rightNearToExit.id,
        waypoints: CLASSROOM_ROUTES.rightNearToExit.waypoints,
        duration: 4000,
        walkTexture: NPC_TEX.boyWalk,
      },
    },
    {
      id: "student_d",
      textureKey: NPC_TEX.girlIdle,
      at: { x: 452, y: 620 },
      role: "teen",
      figureFill: 0.96,
      behavior: { kind: "idle_sway" },
      evacuate: {
        delay: 2400,
        routeId: CLASSROOM_ROUTES.centerAisleToExit.id,
        waypoints: CLASSROOM_ROUTES.centerAisleToExit.waypoints,
        duration: 4200,
        walkTexture: NPC_TEX.girlWalk,
      },
    },
  ],
  fx: { dust: true },
  /**
   * Парты — по ним ходить нельзя (тюнинг: ?debugCollisions=1).
   * Откалибровано по арту: между рядами свободный «коридор» y≈503–545,
   * центральный проход x≈510–785, подход к двери — верхним коридором.
   */
  obstacles: [
    // левый ряд парт (средний и ближний; верхний ряд — за yTop)
    { x: 40, y: 552, width: 470, height: 46 },
    { x: 0, y: 645, width: 455, height: 65 },
    // правый ряд парт
    { x: 785, y: 552, width: 455, height: 48 },
    { x: 795, y: 645, width: 485, height: 65 },
  ],
};

// ----------------------------------------------------------------- corridor

/**
 * Коридор у класса — спокойный участок: дым только едва заметен вдалеке,
 * коридор полностью читается. Навык: оценить обстановку, а не бежать
 * автоматически (заминка на месте → assessed_corridor в SchoolScene).
 * Переход в холл — физическим движением к дальней части коридора.
 */
const corridor: RoomLayout = {
  id: "corridor",
  backgroundKey: BG.corridor,
  walk: {
    yTop: 368,
    yBottom: 700,
    xTopMin: 545,
    xTopMax: 760,
    xBottomMin: 130,
    xBottomMax: 1150,
  },
  perspective: {
    farY: 368,
    farAdultHeight: 170,
    nearY: 700,
    nearAdultHeight: 390,
  },
  playerRole: "teen",
  spawns: {
    fromClassroom: { x: 1010, y: 645 },
  },
  exits: [],
  /** Дальняя часть коридора ведёт в центральный холл. */
  autoExits: [
    {
      rect: { x: 548, y: 368, width: 210, height: 48 },
      target: "central_hall",
      spawn: "fromCorridor",
      telemetryEvent: "entered_central_hall",
    },
  ],
  hotspots: [],
  props: [],
  npcs: [
    // Ученики уже двигаются к основному маршруту (вглубь, к холлу).
    {
      id: "evacuating_boy",
      textureKey: NPC_TEX.boyWalk,
      at: { x: 700, y: 535 },
      role: "teen",
      figureFill: 0.96,
      behavior: {
        kind: "walker",
        to: { x: 655, y: 395 },
        duration: 6500,
        repeatDelay: 5500,
        fadeAtEnd: true,
      },
    },
    {
      id: "evacuating_girl",
      textureKey: NPC_TEX.girlWalk,
      at: { x: 620, y: 555 },
      role: "teen",
      figureFill: 0.95,
      behavior: {
        kind: "walker",
        to: { x: 630, y: 400 },
        duration: 7200,
        repeatDelay: 6000,
        fadeAtEnd: true,
      },
    },
    {
      id: "confused_student",
      textureKey: NPC_TEX.girlConfused,
      at: { x: 885, y: 535 },
      role: "teen",
      figureFill: 0.96,
      behavior: {
        kind: "confused",
        helpHotspotId: "help_student",
        followTexture: NPC_TEX.girlWalk,
      },
    },
    // Учитель ещё оценивает обстановку у классов.
    {
      id: "teacher_assessing",
      textureKey: NPC_TEX.teacherIdle,
      at: { x: 338, y: 610 },
      role: "adult",
      figureFill: 0.97,
      behavior: { kind: "idle_sway" },
    },
  ],
  fx: {
    // Едва заметный distant smoke — коридор должен читаться целиком.
    smoke: [
      { at: { x: 620, y: 318 }, anim: FX_ANIM.smokeLight, scale: 0.42, alpha: 0.18, drift: 8 },
    ],
    alarm: true,
    dust: true,
  },
  objectiveKey: "game.objectiveCorridor",
};

// ------------------------------------------------------------- central hall

/**
 * Центральный холл — главная decision room. На фоне: главный выход слева
 * (НЕГІЗГІ ШЫҒУ), запасной справа (ҚОСАЛҚЫ ШЫҒУ), план эвакуации в центре.
 * Дым нарастает стадиями (distant → light → medium → blocked); на medium
 * NPC останавливаются и перенаправляются. Навык: изменить привычный
 * маршрут, если он стал опасным.
 */
const centralHall: RoomLayout = {
  id: "central_hall",
  backgroundKey: BG.centralHall,
  walk: {
    yTop: 430,
    yBottom: 700,
    xTopMin: 240,
    xTopMax: 1040,
    xBottomMin: 80,
    xBottomMax: 1230,
  },
  // Проём запасного выхода ≈ 274 px в основании (y≈438) → взрослый ≈ 215.
  perspective: {
    farY: 430,
    farAdultHeight: 215,
    nearY: 700,
    nearAdultHeight: 380,
  },
  playerRole: "teen",
  spawns: {
    fromCorridor: { x: 180, y: 655 },
  },
  exits: [
    {
      id: "side_exit_door",
      at: { x: 980, y: 455 },
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
      at: { x: 640, y: 455 },
      radius: 90,
      labelKey: "game.interact.viewPlan",
      scenarioEvent: "evacuation_plan_checked",
      once: true,
    },
    {
      id: "safe_exit_sign",
      at: { x: 920, y: 470 },
      radius: 85,
      labelKey: "game.interact.checkExitSign",
      scenarioEvent: "safe_exit_sign_detected",
      once: true,
    },
    {
      id: "ask_teacher",
      at: { x: 860, y: 535 },
      radius: 90,
      labelKey: "game.interact.askTeacher",
      scenarioEvent: "ask_teacher_route",
      once: true,
    },
  ],
  props: [],
  /** Стенд плана и колонны — нельзя проходить навылет. */
  obstacles: [
    { x: 600, y: 430, width: 90, height: 36 },
  ],
  npcs: [
    {
      id: "teacher_hall",
      textureKey: NPC_TEX.teacherIdle,
      at: { x: 860, y: 535 },
      role: "adult",
      figureFill: 0.97,
      behavior: { kind: "idle_sway" },
    },
    // Группа привычно идёт к главному выходу; на medium-стадии дыма
    // останавливается и по сигналу учителя поворачивает к запасному.
    // Конечные точки — сбоку от двери, чтобы не перекрывать игроку выход.
    {
      id: "hall_group",
      textureKey: NPC_TEX.groupEvacuating,
      at: { x: 620, y: 585 },
      role: "teen",
      figureFill: 0.78,
      behavior: {
        kind: "redirect",
        toward: { x: 420, y: 490 },
        towardDuration: 4200,
        pauseMs: 900,
        then: { x: 900, y: 555 },
        thenDuration: 3800,
      },
    },
    {
      id: "hall_pair",
      textureKey: NPC_TEX.pairWalking,
      at: { x: 500, y: 650 },
      role: "teen",
      figureFill: 0.9,
      behavior: {
        kind: "redirect",
        toward: { x: 380, y: 520 },
        towardDuration: 5200,
        pauseMs: 1100,
        then: { x: 880, y: 580 },
        thenDuration: 4200,
      },
    },
    {
      id: "hall_girl",
      textureKey: NPC_TEX.girlIdle,
      at: { x: 560, y: 560 },
      role: "teen",
      figureFill: 0.96,
      behavior: { kind: "idle_sway" },
    },
  ],
  fx: {
    /**
     * Послойный дым у главного выхода. Ни одна стадия не закрывает комнату
     * целиком; плотный дым — только в глубине главного коридора (y < yTop,
     * вне проходимой зоны — NPC там не стоят).
     */
    smokeStages: {
      distant: {
        smoke: [
          { at: { x: 370, y: 300 }, anim: FX_ANIM.smokeLight, scale: 0.55, alpha: 0.3, drift: 8 },
        ],
      },
      light: {
        smoke: [
          { at: { x: 330, y: 310 }, anim: FX_ANIM.smokeLight, scale: 0.8, alpha: 0.45, drift: 12 },
          { at: { x: 450, y: 305 }, anim: FX_ANIM.smokeLight, scale: 0.7, alpha: 0.4, drift: 10 },
        ],
      },
      medium: {
        smoke: [
          { at: { x: 360, y: 330 }, anim: FX_ANIM.smokeMedium, scale: 0.9, alpha: 0.55, drift: 14 },
          { at: { x: 470, y: 325 }, anim: FX_ANIM.smokeMedium, scale: 0.8, alpha: 0.5, drift: 12 },
        ],
        haze: {
          rect: { x: 240, y: 240, width: 320, height: 180 },
          textureKey: FX_TEX.hazeGray,
          alpha: 0.28,
        },
      },
      blocked: {
        smoke: [
          { at: { x: 355, y: 350 }, anim: FX_ANIM.smokeHeavy, scale: 1.0, alpha: 0.7, drift: 16 },
          { at: { x: 430, y: 345 }, anim: FX_ANIM.smokeHeavy, scale: 0.9, alpha: 0.65, drift: 14 },
        ],
        haze: {
          rect: { x: 250, y: 230, width: 330, height: 210 },
          textureKey: FX_TEX.hazeGray,
          alpha: 0.4,
        },
      },
    },
    alarm: true,
    dust: true,
  },
  /**
   * Прогрессия дыма: комбинация времени в комнате, близости игрока к
   * главному маршруту и реакции NPC (redirect на medium). Игрок всегда
   * успевает увидеть обычный маршрут до того, как он «закроется».
   */
  smokeProgression: {
    lightAfterMs: 2600,
    mediumAfterMs: 7500,
    blockedAfterMs: 11500,
    approachRect: { x: 240, y: 430, width: 400, height: 110 },
  },
  dangerZone: {
    rect: { x: 240, y: 430, width: 380, height: 100 },
    lingerEvent: "route_blocked",
    lingerMs: 2500,
  },
  objectiveKey: "game.objectiveHall",
};

// ------------------------------------------------------------------- stairs

const stairs: RoomLayout = {
  id: "stairs",
  backgroundKey: BG.stairs,
  walk: {
    yTop: 520,
    yBottom: 706,
    xTopMin: 200,
    xTopMax: 1090,
    xBottomMin: 90,
    xBottomMax: 1230,
  },
  perspective: {
    farY: 470,
    farAdultHeight: 185,
    nearY: 706,
    nearAdultHeight: 365,
  },
  playerRole: "teen",
  spawns: {
    fromCentralHall: { x: 1090, y: 640 },
  },
  exits: [],
  autoExits: [
    {
      rect: { x: 380, y: 672, width: 300, height: 44 },
      target: "vestibule",
      spawn: "fromStairs",
      telemetryEvent: "descended_stairs",
    },
  ],
  hotspots: [],
  props: [],
  /** Плотная группа: сквозь неё медленно; свободный проход справа (без
   *  преждевременной зелёной подсветки — игрок замечает сам). */
  /** Поток чуть медленнее, но стабильно (не «залипание»). */
  slowZones: [{ rect: { x: 440, y: 565, width: 250, height: 100 }, factor: 0.52 }],
  calmLane: { x: 740, y: 632, width: 320, height: 70 },
  npcs: [
    {
      id: "landing_group",
      textureKey: NPC_TEX.groupEvacuating,
      at: { x: 565, y: 615 },
      role: "teen",
      figureFill: 0.8,
      behavior: { kind: "idle_sway" },
    },
    {
      id: "teacher_descending",
      textureKey: NPC_TEX.teacherWalk,
      at: { x: 960, y: 545 },
      role: "adult",
      figureFill: 0.97,
      flipX: true,
      behavior: {
        kind: "walker",
        to: { x: 700, y: 685 },
        duration: 6500,
        repeatDelay: 8500,
        fadeAtEnd: true,
      },
    },
    {
      id: "students_pair",
      textureKey: NPC_TEX.pairWalking,
      at: { x: 280, y: 615 },
      role: "teen",
      figureFill: 0.9,
      behavior: {
        kind: "walker",
        to: { x: 620, y: 700 },
        duration: 5200,
        repeatDelay: 11000,
        fadeAtEnd: true,
      },
    },
  ],
  fx: { alarm: true, dust: true },
  objectiveKey: "game.objectiveStairs",
};

// ---------------------------------------------------------------- vestibule

/**
 * Тамбур — последняя внутренняя комната: открытая дверь наружу, знаки
 * ШЫҒУ и «ҒИМАРАТҚА ҚАЙТА КІРМЕҢІЗ» на фоне. Навык: выход из здания —
 * ещё не конец эвакуации, возвращаться нельзя.
 */
const vestibule: RoomLayout = {
  id: "vestibule",
  backgroundKey: BG.vestibule,
  walk: {
    yTop: 575,
    yBottom: 705,
    xTopMin: 430,
    xTopMax: 850,
    xBottomMin: 150,
    xBottomMax: 1130,
  },
  // Комната неглубокая, камера близко: фигуры крупные.
  perspective: {
    farY: 575,
    farAdultHeight: 320,
    nearY: 705,
    nearAdultHeight: 405,
  },
  playerRole: "teen",
  spawns: {
    fromStairs: { x: 260, y: 672 },
  },
  exits: [],
  /** Открытые двери: дошёл до порога — вышел из здания. */
  autoExits: [
    {
      rect: { x: 520, y: 575, width: 240, height: 38 },
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
      textureKey: NPC_TEX.pairWalking,
      at: { x: 320, y: 695 },
      role: "teen",
      figureFill: 0.9,
      behavior: {
        kind: "walker",
        to: { x: 630, y: 605 },
        duration: 4200,
        repeatDelay: 12000,
        fadeAtEnd: true,
      },
    },
  ],
  fx: { dust: true },
  objectiveKey: "game.objectiveVestibule",
};

// ------------------------------------------------------------------ outdoor

const outdoor: RoomLayout = {
  id: "outdoor",
  backgroundKey: BG.outdoor,
  walk: {
    yTop: 430,
    yBottom: 700,
    xTopMin: 330,
    xTopMax: 1230,
    xBottomMin: 60,
    xBottomMax: 1240,
  },
  perspective: {
    farY: 430,
    farAdultHeight: 165,
    nearY: 700,
    nearAdultHeight: 350,
  },
  playerRole: "teen",
  spawns: {
    /** Смещение от дверей: случайный touch reentry-зоны на spawn не срабатывает. */
    fromVestibule: { x: 340, y: 640 },
  },
  exits: [],
  autoExits: [],
  /** Сценарий завершается только докладом учителю на точке сбора. */
  hotspots: [
    {
      id: "report_teacher",
      at: { x: 860, y: 568 },
      radius: 115,
      labelKey: "game.interact.reportTeacher",
      scenarioEvent: "reported_to_teacher",
      once: true,
    },
  ],
  props: [
    {
      textureKey: OBJECT_TEX.assemblySign,
      at: { x: 920, y: 475 },
      height: 110,
      depthBias: -20,
    },
  ],
  npcs: [
    {
      id: "assembly_crowd",
      textureKey: NPC_TEX.groupAssembly,
      at: { x: 1000, y: 555 },
      role: "teen",
      figureFill: 0.82,
      behavior: { kind: "idle_sway" },
    },
    {
      id: "assembly_boy",
      textureKey: NPC_TEX.boyIdle,
      at: { x: 780, y: 575 },
      role: "teen",
      figureFill: 0.96,
      behavior: { kind: "idle_sway" },
    },
    {
      id: "assembly_teacher",
      textureKey: NPC_TEX.teacherIdle,
      at: { x: 860, y: 565 },
      role: "adult",
      figureFill: 0.97,
      flipX: true,
      behavior: { kind: "idle_sway" },
    },
  ],
  fx: {},
  objectiveKey: "game.objectiveAssembly",
};

export const ROOM_LAYOUTS: Record<RoomId, RoomLayout> = {
  classroom,
  corridor,
  central_hall: centralHall,
  stairs,
  vestibule,
  outdoor,
};

export const ROOM_ENTER_MESSAGE: Record<RoomId, string> = {
  classroom: "game.room.classroom",
  corridor: "game.room.corridor",
  central_hall: "game.room.centralHall",
  stairs: "game.room.stairs",
  vestibule: "game.room.vestibule",
  outdoor: "game.room.outdoor",
};
