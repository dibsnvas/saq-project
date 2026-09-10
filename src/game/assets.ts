/**
 * AssetRegistry: единый список ключей и путей всех внешних ассетов.
 * Сцены обращаются только к ключам — пути и структура /public/assets
 * меняются в одном месте. Соответствие исходникам пака — docs/asset-map.md.
 */

export const BG = {
  classroom: "bg-classroom",
  corridor: "bg-corridor",
  centralHall: "bg-central-hall",
  stairs: "bg-stairs",
  vestibule: "bg-vestibule",
  outdoor: "bg-outdoor",
} as const;

export const PLAYER_TEX = {
  idle: {
    up: "player-idle-back",
    down: "player-idle-front",
    left: "player-idle-left",
    right: "player-idle-right",
  },
  /** «пригнувшись, рот закрыт тканью» — грузит пакет офиса */
  crouch: {
    back: "player-crouch-back",
    side: "player-crouch-side",
  },
  walkPrefix: {
    up: "player-walk-back-",
    down: "player-walk-front-",
    left: "player-walk-left-",
    right: "player-walk-right-",
  },
} as const;

export const PLAYER_ANIM = {
  up: "player-anim-up",
  down: "player-anim-down",
  left: "player-anim-left",
  right: "player-anim-right",
} as const;

export type Direction = "up" | "down" | "left" | "right";

export const NPC_TEX = {
  groupAssembly: "npc-group-assembly",
  groupEvacuating: "npc-group-evacuating",
  pairWalking: "npc-pair-walking",
  girlConfused: "npc-girl-confused",
  girlIdle: "npc-girl-idle",
  girlWalk: "npc-girl-walk",
  boyIdle: "npc-boy-idle",
  boyPointing: "npc-boy-pointing",
  boyWalk: "npc-boy-walk",
  teacherIdle: "npc-teacher-idle",
  teacherWalk: "npc-teacher-walk",
} as const;

export const OBJECT_TEX = {
  assemblySign: "obj-assembly-sign",
  backpack: "obj-backpack",
  doorClosed: "obj-door-closed",
  doorOpen: "obj-door-open",
  exitSign: "obj-exit-sign",
  safetyBoard: "obj-safety-board",
  warningTriangle: "obj-warning-triangle",
} as const;

export const FX_TEX = {
  smokeMediumPrefix: "fx-smoke-medium-",
  smokeHeavyPrefix: "fx-smoke-heavy-",
  smokeLightPrefix: "fx-smoke-light-",
  hazeGray: "fx-haze-gray",
  hazeOrange: "fx-haze-orange",
  alertGlowWide: "fx-alert-glow-wide",
  alertOverlayRed: "fx-alert-overlay-red",
  alarmBeacon: "fx-alarm-beacon",
} as const;

export const FX_ANIM = {
  smokeMedium: "fx-anim-smoke-medium",
  smokeHeavy: "fx-anim-smoke-heavy",
  smokeLight: "fx-anim-smoke-light",
} as const;

export interface AssetEntry {
  key: string;
  url: string;
}

/**
 * Манифест загрузки для PreloadScene: общие ассеты (игрок, объекты, дым)
 * плюс ассеты здания из пакета сценария — фоны, NPC и его пропы.
 */
export function buildManifest(scenarioAssets: AssetEntry[]): AssetEntry[] {
  const entries: AssetEntry[] = [
    ...scenarioAssets,
    { key: PLAYER_TEX.idle.up, url: "assets/player/player_idle_back.png" },
    { key: PLAYER_TEX.idle.down, url: "assets/player/player_idle_front.png" },
    { key: PLAYER_TEX.idle.left, url: "assets/player/player_idle_left.png" },
    { key: PLAYER_TEX.idle.right, url: "assets/player/player_idle_right.png" },

    { key: OBJECT_TEX.assemblySign, url: "assets/objects/assembly_point_sign.png" },
    { key: OBJECT_TEX.doorClosed, url: "assets/objects/door_closed.png" },
    { key: OBJECT_TEX.doorOpen, url: "assets/objects/door_open.png" },
    { key: OBJECT_TEX.exitSign, url: "assets/objects/exit_sign.png" },
    { key: OBJECT_TEX.safetyBoard, url: "assets/objects/safety_board.png" },
    { key: OBJECT_TEX.warningTriangle, url: "assets/objects/warning_triangle.png" },

    { key: FX_TEX.hazeGray, url: "assets/effects/haze_gray.png" },
    { key: FX_TEX.hazeOrange, url: "assets/effects/haze_orange.png" },
    { key: FX_TEX.alertGlowWide, url: "assets/effects/alert_glow_wide.png" },
    { key: FX_TEX.alertOverlayRed, url: "assets/effects/alert_overlay_red.png" },
    { key: FX_TEX.alarmBeacon, url: "assets/effects/alarm_beacon.png" },
  ];

  for (const dir of ["back", "front", "left", "right"] as const) {
    const prefixMap = {
      back: PLAYER_TEX.walkPrefix.up,
      front: PLAYER_TEX.walkPrefix.down,
      left: PLAYER_TEX.walkPrefix.left,
      right: PLAYER_TEX.walkPrefix.right,
    };
    // Только кадры 1–2: 3–4 имеют белый/серый мат.
    for (const i of [1, 2] as const) {
      entries.push({
        key: `${prefixMap[dir]}${i}`,
        url: `assets/player/player_walk_${dir}_${i}.png`,
      });
    }
  }

  for (const density of ["light", "medium", "heavy"] as const) {
    const prefix = {
      light: FX_TEX.smokeLightPrefix,
      medium: FX_TEX.smokeMediumPrefix,
      heavy: FX_TEX.smokeHeavyPrefix,
    }[density];
    for (let i = 1; i <= 6; i++) {
      entries.push({
        key: `${prefix}${i}`,
        url: `assets/effects/smoke_${density}_${i}.png`,
      });
    }
  }

  return entries;
}
