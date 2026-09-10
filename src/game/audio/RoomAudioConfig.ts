/**
 * Данные аудиосистемы: состояния, слои-лупы, случайные one-shot'ы и уровни
 * громкости по категориям. Логики здесь нет — только конфигурация
 * (аналог rooms/layouts.ts для звука). Замена ассетов — docs/audio-map.md.
 */

export type AudioCategory =
  | "ambience"
  | "alarm"
  | "voice"
  | "footsteps"
  | "ui"
  | "music";

/**
 * Состояния звуковой сцены:
 * corridor — коридор у класса (лёгкая толпа, без tension);
 * central_hall — decision room до medium smoke (плотнее толпа + голос учителя);
 * smoke_danger — medium/blocked или вход в danger-зону;
 * side_corridor — запасной маршрут после осознания дыма;
 * vestibule — тамбур: тревога↓, двор↑;
 * paused — служебный duck без смены слоёв.
 */
export type AudioStateId =
  | "lesson"
  | "alarm_start"
  | "classroom_evacuation"
  | "corridor"
  | "central_hall"
  | "smoke_danger"
  | "side_corridor"
  | "stairs"
  | "vestibule"
  | "outdoor"
  | "success"
  | "timeout"
  | "paused";

/** Единый реестр путей: подмена файла — в одном месте. */
export const AUDIO_FILES = {
  classroomAmbience: "/audio/ambience/classroom_ambience.wav",
  corridorCrowd: "/audio/ambience/corridor_crowd.wav",
  smokeTension: "/audio/ambience/smoke_tension.wav",
  sideSuspense: "/audio/ambience/side_suspense.wav",
  outdoorAmbience: "/audio/ambience/outdoor_ambience.wav",
  ventHum: "/audio/ambience/vent_hum.wav",
  crowdShuffle: "/audio/ambience/crowd_shuffle.wav",
  alarmLoop: "/audio/alarms/alarm_loop.wav",
  footstepsWalk: "/audio/footsteps/footsteps_walk.wav",
  footstepsStairs: "/audio/footsteps/stairs_footsteps.wav",
  doorOpen: "/audio/ui/door_open.wav",
  uiClick: "/audio/ui/ui_click.wav",
  crowdBump: "/audio/ui/crowd_bump.wav",
  lowCompletion: "/audio/ui/low_completion.wav",
  coughSoft: "/audio/voices/cough_soft.wav",
  teacherMuffled: "/audio/voices/teacher_muffled.wav",
  successChime: "/audio/music/success_chime.wav",
  successMusic: "/audio/music/success_music.wav",
} as const;

/** Луп-слой состояния. */
export interface AudioLoopSpec {
  url: string;
  category: AudioCategory;
  /** целевая громкость слоя (умножается на громкость категории и master) */
  volume: number;
  /**
   * Слой «следует за движением игрока»: громкость дополнительно умножается
   * на фактор движения (0 — стоим, 1 — идём). Используется для шагов.
   */
  movement?: boolean;
}

/** Случайные редкие one-shot'ы состояния (голоса, кашель, шорохи). */
export interface AudioOneShotSpec {
  /**
   * Кандидаты в порядке приоритета: первый существующий файл проигрывается.
   * Позволяет класть локализованные записи (voices/kk|ru/*) поверх
   * placeholder'а — без изменения кода.
   */
  urls: string[] | ((locale: string) => string[]);
  category: AudioCategory;
  volume: number;
  /** случайный интервал повторения, мс */
  minDelayMs: number;
  maxDelayMs: number;
}

export interface AudioStateConfig {
  loops: AudioLoopSpec[];
  oneShots?: AudioOneShotSpec[];
}

/** Плавность смены состояний по умолчанию, мс. */
export const AUDIO_CROSSFADE_MS = 900;

/** Насколько давится звук на паузе (духа «стоп-кадра», loops не убиваем). */
export const PAUSE_DUCK_LEVEL = 0.06;

/**
 * Локализованные короткие реплики в коридоре. Файлы пока отсутствуют —
 * система тихо падает на placeholder teacher_muffled (см. audio-map.md).
 * kk: «Сабыр сақтаңдар!», «Асықпаңдар!», «Мұғалімнің артынан жүріңдер!»
 */
let calmVoiceNames: Record<"ru" | "kk", string[]> = {
  kk: ["sabyr_saqtandar", "asykpandar", "mugalimnin_artynan"],
  ru: ["sohranyaite_spokoistvie", "ne_toropites", "idite_za_uchitelem"],
};

/** Набор реплик задаёт пакет сценария: «Идите за учителем» в ТРЦ неуместно. */
export function setCalmVoiceNames(names: Record<"ru" | "kk", string[]>): void {
  calmVoiceNames = names;
}

const localizedCalmVoices = (locale: string): string[] => {
  const names = locale === "kk" ? calmVoiceNames.kk : calmVoiceNames.ru;
  return [
    ...names.map((n) => `/audio/voices/${locale}/${n}.mp3`),
    AUDIO_FILES.teacherMuffled,
  ];
};

const localizedRedirectVoice = (locale: string): string[] => [
  `/audio/voices/${locale}/teacher_redirect.mp3`,
  AUDIO_FILES.teacherMuffled,
];

/** Редкая реплика: большие интервалы, чтобы не звучать постоянно. */
const calmVoiceOneShot: AudioOneShotSpec = {
  urls: localizedCalmVoices,
  category: "voice",
  volume: 0.45,
  minDelayMs: 12_000,
  maxDelayMs: 26_000,
};

const doorOneShot: AudioOneShotSpec = {
  urls: [AUDIO_FILES.doorOpen],
  category: "ui",
  volume: 0.22,
  minDelayMs: 9_000,
  maxDelayMs: 20_000,
};

export const AUDIO_STATES: Record<AudioStateId, AudioStateConfig> = {
  /** До тревоги — используется только если игра начинается без видео-интро. */
  lesson: {
    loops: [
      { url: AUDIO_FILES.classroomAmbience, category: "ambience", volume: 0.3 },
    ],
  },

  /** Класс сразу после тревоги: сигнал + класс приходит в движение. */
  alarm_start: {
    loops: [
      { url: AUDIO_FILES.alarmLoop, category: "alarm", volume: 0.42 },
      { url: AUDIO_FILES.classroomAmbience, category: "ambience", volume: 0.26 },
      { url: AUDIO_FILES.crowdShuffle, category: "ambience", volume: 0.16 },
      {
        url: AUDIO_FILES.footstepsWalk,
        category: "footsteps",
        volume: 0.34,
        movement: true,
      },
    ],
  },

  /** Класс в процессе выхода: стулья/шаги учеников слышнее. */
  classroom_evacuation: {
    loops: [
      { url: AUDIO_FILES.alarmLoop, category: "alarm", volume: 0.4 },
      { url: AUDIO_FILES.classroomAmbience, category: "ambience", volume: 0.22 },
      { url: AUDIO_FILES.crowdShuffle, category: "ambience", volume: 0.24 },
      {
        url: AUDIO_FILES.footstepsWalk,
        category: "footsteps",
        volume: 0.36,
        movement: true,
      },
    ],
    oneShots: [doorOneShot],
  },

  /** Коридор у класса: лёгкая толпа, шаги, без tension layer. */
  corridor: {
    loops: [
      { url: AUDIO_FILES.alarmLoop, category: "alarm", volume: 0.38 },
      { url: AUDIO_FILES.corridorCrowd, category: "ambience", volume: 0.22 },
      {
        url: AUDIO_FILES.footstepsWalk,
        category: "footsteps",
        volume: 0.36,
        movement: true,
      },
    ],
    oneShots: [calmVoiceOneShot, doorOneShot],
  },

  /** Центральный холл до medium: плотнее толпа, редкие реплики учителя. */
  central_hall: {
    loops: [
      { url: AUDIO_FILES.alarmLoop, category: "alarm", volume: 0.42 },
      { url: AUDIO_FILES.corridorCrowd, category: "ambience", volume: 0.34 },
      {
        url: AUDIO_FILES.footstepsWalk,
        category: "footsteps",
        volume: 0.34,
        movement: true,
      },
    ],
    oneShots: [
      calmVoiceOneShot,
      {
        urls: localizedRedirectVoice,
        category: "voice",
        volume: 0.45,
        minDelayMs: 12_000,
        maxDelayMs: 24_000,
      },
    ],
  },

  /** Зона дыма у главного выхода: плотнее толпа, низкое напряжение, кашель. */
  smoke_danger: {
    loops: [
      { url: AUDIO_FILES.alarmLoop, category: "alarm", volume: 0.44 },
      { url: AUDIO_FILES.corridorCrowd, category: "ambience", volume: 0.35 },
      { url: AUDIO_FILES.smokeTension, category: "ambience", volume: 0.24 },
      { url: AUDIO_FILES.ventHum, category: "ambience", volume: 0.12 },
      {
        url: AUDIO_FILES.footstepsWalk,
        category: "footsteps",
        volume: 0.32,
        movement: true,
      },
    ],
    oneShots: [
      {
        urls: [AUDIO_FILES.coughSoft],
        category: "voice",
        volume: 0.3,
        minDelayMs: 7_000,
        maxDelayMs: 15_000,
      },
      {
        urls: localizedRedirectVoice,
        category: "voice",
        volume: 0.5,
        minDelayMs: 10_000,
        maxDelayMs: 22_000,
      },
    ],
  },

  /** Безопасный маршрут: тише толпа и тревога, чётче собственные шаги. */
  side_corridor: {
    loops: [
      { url: AUDIO_FILES.alarmLoop, category: "alarm", volume: 0.3 },
      { url: AUDIO_FILES.corridorCrowd, category: "ambience", volume: 0.12 },
      { url: AUDIO_FILES.sideSuspense, category: "ambience", volume: 0.22 },
      {
        url: AUDIO_FILES.footstepsWalk,
        category: "footsteps",
        volume: 0.44,
        movement: true,
      },
    ],
  },

  /** Лестница: шаги с эхом, движение группы, редкая спокойная реплика. */
  stairs: {
    loops: [
      { url: AUDIO_FILES.alarmLoop, category: "alarm", volume: 0.34 },
      { url: AUDIO_FILES.corridorCrowd, category: "ambience", volume: 0.24 },
      { url: AUDIO_FILES.crowdShuffle, category: "ambience", volume: 0.22 },
      {
        url: AUDIO_FILES.footstepsStairs,
        category: "footsteps",
        volume: 0.4,
        movement: true,
      },
    ],
    oneShots: [calmVoiceOneShot],
  },

  /** Тамбур: тревога↓, indoor↓, двор/ветер↑ через открытые двери. */
  vestibule: {
    loops: [
      { url: AUDIO_FILES.alarmLoop, category: "alarm", volume: 0.18 },
      { url: AUDIO_FILES.corridorCrowd, category: "ambience", volume: 0.08 },
      { url: AUDIO_FILES.outdoorAmbience, category: "ambience", volume: 0.26 },
      {
        url: AUDIO_FILES.footstepsWalk,
        category: "footsteps",
        volume: 0.34,
        movement: true,
      },
    ],
  },

  /** Двор: приглушённая тревога из здания, ветер, птицы, тихие голоса. */
  outdoor: {
    loops: [
      { url: AUDIO_FILES.outdoorAmbience, category: "ambience", volume: 0.32 },
      { url: AUDIO_FILES.alarmLoop, category: "alarm", volume: 0.1 },
      {
        url: AUDIO_FILES.footstepsWalk,
        category: "footsteps",
        volume: 0.28,
        movement: true,
      },
    ],
    oneShots: [
      {
        urls: [AUDIO_FILES.crowdShuffle],
        category: "voice",
        volume: 0.14,
        minDelayMs: 8_000,
        maxDelayMs: 18_000,
      },
    ],
  },

  /** «Вы в безопасности»: напряжение снято, двор остаётся под музыкой. */
  success: {
    loops: [
      { url: AUDIO_FILES.outdoorAmbience, category: "ambience", volume: 0.3 },
    ],
  },

  /** Таймаут: без победных звуков, тревога далеко и тихо. */
  timeout: {
    loops: [
      { url: AUDIO_FILES.alarmLoop, category: "alarm", volume: 0.14 },
      { url: AUDIO_FILES.corridorCrowd, category: "ambience", volume: 0.1 },
    ],
  },

  /** Служебное: слои не меняются, работает только duck (см. AudioManager). */
  paused: { loops: [] },
};

/** Базовые громкости категорий (v — итог: master × категория × слой). */
export const CATEGORY_BASE_VOLUME: Record<AudioCategory, number> = {
  ambience: 1,
  alarm: 1,
  voice: 1,
  footsteps: 1,
  ui: 0.8,
  music: 1,
};
