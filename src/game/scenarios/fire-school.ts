import scenario from "@/content/fire-school/scenario.json";
import { BG, NPC_TEX, OBJECT_TEX } from "../assets";
import { ROOM_ENTER_MESSAGE, ROOM_LAYOUTS } from "../rooms/layouts";
import type { ScenarioPack } from "./types";

/** «Пожар в школе»: исходный сценарий, из которого вырос движок. */
export const fireSchoolPack: ScenarioPack = {
  id: "fire-school",
  scenario,
  layouts: ROOM_LAYOUTS,
  roomEnterMessage: ROOM_ENTER_MESSAGE,
  assets: [
    { key: BG.classroom, url: "assets/backgrounds/classroom_start.jpg" },
    { key: BG.corridor, url: "assets/backgrounds/corridor_main.jpg" },
    { key: BG.centralHall, url: "assets/backgrounds/central_hall_empty.png" },
    { key: BG.stairs, url: "assets/backgrounds/stairs_emergency.jpg" },
    { key: BG.vestibule, url: "assets/backgrounds/vestibule_empty.png" },
    { key: BG.outdoor, url: "assets/backgrounds/exit_assembly.jpg" },

    { key: NPC_TEX.groupAssembly, url: "assets/npc/npc_group_assembly.png" },
    {
      key: NPC_TEX.groupEvacuating,
      url: "assets/npc/npc_group_evacuating.png",
    },
    // Очищенный от серо-белого мата кадр (исходник — saq_assets_ready).
    {
      key: NPC_TEX.pairWalking,
      url: "assets/npc/processed/npc_pair_walking.png",
    },
    {
      key: NPC_TEX.girlConfused,
      url: "assets/npc/npc_student_girl_confused.png",
    },
    { key: NPC_TEX.girlIdle, url: "assets/npc/npc_student_girl_idle.png" },
    { key: NPC_TEX.girlWalk, url: "assets/npc/npc_student_girl_walk.png" },
    { key: NPC_TEX.boyIdle, url: "assets/npc/npc_student_boy_idle.png" },
    {
      key: NPC_TEX.boyPointing,
      url: "assets/npc/npc_student_boy_pointing.png",
    },
    { key: NPC_TEX.boyWalk, url: "assets/npc/npc_student_boy_walk.png" },
    { key: NPC_TEX.teacherIdle, url: "assets/npc/npc_teacher_idle.png" },
    { key: NPC_TEX.teacherWalk, url: "assets/npc/npc_teacher_walk.png" },

    { key: OBJECT_TEX.backpack, url: "assets/objects/backpack_object.png" },
  ],
  intro: {
    video: "/videos/fire-school-intro.mp4",
    // Ролик — живая запись урока со звуком: язык записи совпадает с языком
    // интерфейса, иначе русский игрок слышит казахскую речь.
    videoByLocale: { ru: "/videos/fire-school-intro.ru.mp4" },
    poster: "/assets/backgrounds/classroom_students_poster.jpg",
    nameKey: "scenario.fireSchool.name",
  },
  companion: {
    idleTexture: NPC_TEX.girlIdle,
    walkTexture: NPC_TEX.girlWalk,
    role: "teen",
    figureFill: 0.96,
    assemblyAt: { x: 940, y: 560 },
  },
  // «Пожар» — один сценарий из двух локаций: после школы — ТРЦ.
  next: { href: "/play/fire-mall", labelKey: "debrief.nextLocation" },
  bubbles: {
    ru: {
      together: "Иду с вами",
      wait: "Жду учителя",
      accept: "Хорошо, оставайся",
      stay: "Я подожду здесь",
      redirect: "К запасному выходу!",
      reportAck: "Принято. Все на месте.",
    },
    kk: {
      together: "Сізбен барамын",
      wait: "Мұғалімді күтемін",
      accept: "Жақсы, күт",
      stay: "Осында тұрамын",
      redirect: "Қосалқы шығуға!",
      reportAck: "Қабылданды. Бәрі жиналды.",
    },
  },
  calmVoices: {
    ru: ["sohranyaite_spokoistvie", "ne_toropites", "idite_za_uchitelem"],
    kk: ["sabyr_saqtandar", "asykpandar", "mugalimnin_artynan"],
  },
  geometry: {
    corridorViewRect: { x: 520, y: 0, width: 280, height: 460 },
    hallFarFromSmokeMinY: 560,
    interventionPush: { x: 64, y: 36 },
    stairsTowardExitMaxX: 700,
    reentryPushX: 56,
    backpack: { textureKey: OBJECT_TEX.backpack, fallback: { x: 492, y: 636 } },
  },
};
