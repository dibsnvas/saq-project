import Phaser from "phaser";
import {
  BASE_ZOOM,
  GAME_HEIGHT,
  GAME_WIDTH,
  PLAYER_SPEED,
  REGISTRY_DEBUG_COLLISIONS,
  REGISTRY_DEBUG_NPC_PATHS,
  REGISTRY_DEBUG_PERSPECTIVE,
  REGISTRY_PACK_KEY,
  REGISTRY_SCENARIO_KEY,
} from "../constants";
import { eventBus } from "../EventBus";
import { FX_TEX, PLAYER_ANIM, PLAYER_TEX, type Direction } from "../assets";
import type { ScenarioDefinition } from "../scenario/schema";
import {
  addRouteEvidence,
  createScenarioState,
  type ScenarioState,
} from "../scenario/state";
import { CORRECTION_POLICY, TEACHER_INTERVENTION } from "../scenario/branching";
import {
  FALLBACK_HINT,
  shouldRevealCalmLaneHint,
  shouldRevealSafeRouteHint,
} from "../hintPolicy";
import type { HelpChoice, ScenarioPack } from "../scenarios/types";
import type {
  Rect,
  RoomExit,
  RoomId,
  RoomLayout,
  RoomProp,
  SmokeStage,
} from "../rooms/types";
import { clampToWalk, depthNorm, scaleAtDepth } from "../rooms/walk";
import { InputController } from "../systems/InputController";
import { InteractionSystem } from "../systems/InteractionSystem";
import {
  SCENARIO_LOCAL_COMPLETED,
  SCENARIO_LOCAL_COMPLETION_PENDING,
  SCENARIO_LOCAL_EVENT,
  ScenarioEngine,
  type ScenarioCompletedLocalPayload,
} from "../systems/ScenarioEngine";
import { TelemetrySystem } from "../systems/TelemetrySystem";
import { LocalStorageTelemetryRepository } from "../systems/TelemetryRepository";
import { CrowdSystem } from "../systems/CrowdSystem";
import {
  EnvironmentFxSystem,
  smokeStageIndex,
} from "../systems/EnvironmentFxSystem";
import { NpcPathDebugSystem } from "../systems/NpcPathDebugSystem";
import { AmbientAudioSystem } from "../audio/AmbientAudioSystem";
import { audioManager } from "../audio/AudioManager";
import {
  AUDIO_FILES,
  AUDIO_STATES,
  setCalmVoiceNames,
} from "../audio/RoomAudioConfig";
import { MinimapSystem } from "../systems/MinimapSystem";
import { PerspectiveDebugSystem } from "../systems/PerspectiveDebugSystem";
import { CollisionDebugSystem } from "../systems/CollisionDebugSystem";

/** Присевший игрок — такая доля роста стоящего. */
const CROUCH_HEIGHT = 0.72;

/** Выбор у растерянного NPC по умолчанию (школа, ТРЦ). */
const DEFAULT_HELP_CHOICE: HelpChoice = {
  promptKey: "choice.helpStudent.prompt",
  options: [
    { id: "companion", labelKey: "choice.helpStudent.together" },
    { id: "referred", labelKey: "choice.helpStudent.waitTeacher" },
    { id: "declined", labelKey: "choice.helpStudent.cannot" },
  ],
};

/**
 * Комнатная 2.5D-сцена школы: фон-кадр, перспектива, переходы с fade,
 * persistent companion между комнатами.
 */
export class SchoolScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private inputController!: InputController;
  private interactions!: InteractionSystem;
  private engine!: ScenarioEngine;
  private telemetry!: TelemetrySystem;
  private fx!: EnvironmentFxSystem;
  private ambientAudio!: AmbientAudioSystem;
  private crowd!: CrowdSystem;
  private minimap!: MinimapSystem;
  private perspectiveDebug!: PerspectiveDebugSystem;
  private scenarioState!: ScenarioState;
  /** здание: раскладки, спутник, реплики, геометрия */
  private pack!: ScenarioPack;

  private layout!: RoomLayout;
  private roomObjects: Phaser.GameObjects.GameObject[] = [];
  private propByKey = new Map<string, Phaser.GameObjects.Image>();
  private exitMarkers: Phaser.GameObjects.GameObject[] = [];
  private transitioning = false;
  private direction: Direction = "up";
  private moving = false;

  private collisionDebug!: CollisionDebugSystem;
  private totalMs = 0;
  private timeUpFired = false;
  private dangerAccum = 0;
  private dangerWarned = false;
  /** игрок внутри danger-зоны (для звукового состояния smoke_danger) */
  private inDangerZone = false;
  /** дым уже обнаружен — дальше маршрут звучит как «безопасный» */
  private smokeSeen = false;
  /** игрок в зоне замедления (звук мягкого столкновения с толпой) */
  private inSlowZone = false;

  // Staged-прогрессия дыма (central hall)
  private smokeStage: SmokeStage = "none";
  private smokeRoomMs = 0;
  private smokeApproachMs = 0;
  /** redirect NPC + сигнал учителя уже отработали в этом заходе */
  private redirectFired = false;

  // Навык коридора: оценить обстановку осмысленно, не за сам вход
  private corridorStillMs = 0;
  private corridorRoomMs = 0;
  private corridorMinY = Number.POSITIVE_INFINITY;
  private corridorAssessed = false;
  /** защита auto-exit сразу после spawn (мс) */
  private roomEnterGraceMs = 0;

  // Branching: источники маршрута, вмешательство учителя, исправления
  /** знак запасного выхода замечен самостоятельно (до redirect) */
  private signDetected = false;
  /** дым замечен издалека (awareness) */
  private smokeNoticedFar = false;
  private smokeNoticedFarMs = 0;
  /** время с momenta medium-дыма — для «затянул с выбором маршрута» */
  private sinceMediumMs = 0;
  /** кулдаун реплики учителя */
  private interventionCooldownMs = 0;
  /** подход к дыму в текущем визите danger-зоны, мс */
  private dangerVisitMs = 0;
  private smokeApproachCorrectedFired = false;
  private crowdCorrectedFired = false;
  /** Зелёный safe-route hint уже показан (после evidence / intervention / fallback). */
  private safeRouteHintShown = false;
  private calmLaneHintShown = false;
  private fallbackHint = false;
  private corridorIdleMs = 0;
  private stairsIdleMs = 0;
  /** Замедление у дыма (1 = норма); быстро восстанавливается при отходе. */
  private smokeMoveFactor = 1;
  private smokeMuffle = 0;
  /** Краткий штраф скорости после проталкивания на лестнице. */
  private stairsPushSlowMs = 0;

  private npcPathDebug!: NpcPathDebugSystem;
  /** true, пока идёт scripted-движение (возврат за рюкзаком) */
  private scriptedBusy = false;
  /** остаток принудительной блокировки управления, мс */
  private controlLockMs = 0;
  private busUnsubscribes: Array<() => void> = [];
  /** уборка уже выполнена (SHUTDOWN и DESTROY могут прийти оба) */
  private tornDown = false;

  /** пропы комнаты, завязанные на события (огонь, крышка, полотенца) */
  private eventProps: Array<{
    def: RoomProp;
    img: Phaser.GameObjects.Image;
  }> = [];
  /** выходы, у которых уже нарисован маркер */
  private markedExits = new Set<string>();
  /** одноразовые хотспоты, уже использованные (room:id) */
  private usedInteractables = new Set<string>();
  /** зоны выбора, уже пройденные в этом прохождении */
  private choiceZonesDone = new Set<string>();
  /** открыт вопрос зоны выбора — управление ждёт ответа */
  private awaitingChoice = false;
  /** выход с паузой уже запущен (балкон) */
  private exitBeatPending = false;
  /** игрок пригнулся в дыму */
  private crouched = false;
  /** игрок идёт в полный рост в дыму: пелена и замедление */
  private uprightInSmoke = false;

  constructor() {
    super("SchoolScene");
  }

  create(): void {
    const scenario = this.registry.get(
      REGISTRY_SCENARIO_KEY,
    ) as ScenarioDefinition;
    this.pack = this.registry.get(REGISTRY_PACK_KEY) as ScenarioPack;
    setCalmVoiceNames(this.pack.calmVoices);

    this.timeUpFired = false;
    this.transitioning = false;
    this.scriptedBusy = false;
    this.controlLockMs = 0;
    this.busUnsubscribes = [];
    this.tornDown = false;
    this.roomObjects = [];
    this.inDangerZone = false;
    this.smokeSeen = false;
    this.inSlowZone = false;
    this.smokeStage = "none";
    this.smokeRoomMs = 0;
    this.smokeApproachMs = 0;
    this.redirectFired = false;
    this.corridorStillMs = 0;
    this.corridorRoomMs = 0;
    this.corridorMinY = Number.POSITIVE_INFINITY;
    this.corridorAssessed = false;
    this.roomEnterGraceMs = 0;
    this.signDetected = false;
    this.smokeNoticedFar = false;
    this.smokeNoticedFarMs = 0;
    this.sinceMediumMs = 0;
    this.interventionCooldownMs = 0;
    this.dangerVisitMs = 0;
    this.smokeApproachCorrectedFired = false;
    this.crowdCorrectedFired = false;
    this.safeRouteHintShown = false;
    this.calmLaneHintShown = false;
    this.fallbackHint = false;
    this.corridorIdleMs = 0;
    this.stairsIdleMs = 0;
    this.smokeMoveFactor = 1;
    this.smokeMuffle = 0;
    this.stairsPushSlowMs = 0;
    this.eventProps = [];
    this.markedExits = new Set();
    this.usedInteractables = new Set();
    this.choiceZonesDone = new Set();
    this.awaitingChoice = false;
    this.exitBeatPending = false;
    this.crouched = false;
    this.uprightInSmoke = false;
    this.scenarioState = createScenarioState();

    this.inputController = new InputController(this);
    this.interactions = new InteractionSystem(this);
    this.telemetry = new TelemetrySystem(
      scenario.id,
      new LocalStorageTelemetryRepository(),
    );
    this.engine = new ScenarioEngine(
      this,
      scenario,
      this.telemetry,
      this.scenarioState,
      this.pack.policy,
    );
    this.telemetry.setClock(() => this.engine.elapsedMs());
    this.fx = new EnvironmentFxSystem(this);
    this.ambientAudio = new AmbientAudioSystem(this);
    // Контекст уже разблокирован кликом «Начать сценарий»; если нет —
    // повторим на первом решении. Стартовые лупы греем заранее.
    this.ambientAudio.ensureUnlocked();
    audioManager.preload(AUDIO_STATES.alarm_start.loops.map((l) => l.url));
    this.crowd = new CrowdSystem(this, this.pack);
    this.minimap = new MinimapSystem();
    this.perspectiveDebug = new PerspectiveDebugSystem(this);
    this.perspectiveDebug.setEnabled(
      Boolean(this.registry.get(REGISTRY_DEBUG_PERSPECTIVE)),
    );
    this.collisionDebug = new CollisionDebugSystem(this);
    this.collisionDebug.setEnabled(
      Boolean(this.registry.get(REGISTRY_DEBUG_COLLISIONS)),
    );
    this.npcPathDebug = new NpcPathDebugSystem(this);
    this.npcPathDebug.setEnabled(
      Boolean(this.registry.get(REGISTRY_DEBUG_NPC_PATHS)),
    );

    this.createPlayer(scenario);
    this.setupCamera();
    this.fx.createVignette();
    this.fx.startCameraBreathing();

    this.telemetry.start();
    this.engine.start();
    this.loadRoom(scenario.startRoom as RoomId, undefined, scenario.start);

    this.setupTimer(scenario);
    this.wireEvents();

    eventBus.emit("game:ready", { sceneKey: "SchoolScene" });
  }

  update(_time: number, delta: number): void {
    if (this.transitioning) return;

    if (this.engine.isCompleted()) {
      this.stopWalkAnimation();
      this.ambientAudio.setMoving(false);
      return;
    }

    // Outdoor completion beat: NPC/audio живут, ввод и зоны заморожены.
    if (this.engine.isFinishing()) {
      this.stopWalkAnimation();
      this.ambientAudio.setMoving(false);
      this.crowd.update(this.player.x, this.player.y);
      return;
    }

    this.controlLockMs = Math.max(0, this.controlLockMs - delta);
    this.stairsPushSlowMs = Math.max(0, this.stairsPushSlowMs - delta);

    if (this.controlsLocked()) {
      // Ждём первого решения / идёт scripted-сцена: NPC и эффекты живут,
      // управление и триггеры — нет.
      if (!this.scriptedBusy) this.stopWalkAnimation();
      this.ambientAudio.setMoving(this.scriptedBusy);
      this.crowd.update(this.player.x, this.player.y);
      this.updateCollisionDebug();
      return;
    }

    this.updateMovement(delta);
    this.ambientAudio.setMoving(this.moving);
    this.updateCrowdSqueezeAudio();
    this.roomEnterGraceMs = Math.max(0, this.roomEnterGraceMs - delta);
    this.interventionCooldownMs = Math.max(
      0,
      this.interventionCooldownMs - delta,
    );
    this.updateSmokeProgression(delta);
    this.updateCorridorAssess(delta);
    this.updateHallBranching(delta);
    this.updateFallbackHints(delta);
    this.updateDangerLinger(delta);
    this.updateSmokeProximityFeel(delta);
    this.updateChoiceZones();
    if (this.roomEnterGraceMs <= 0) this.checkAutoExits();

    this.interactions.update(this.player.x, this.player.y);
    if (this.inputController.consumeInteract()) {
      this.interactions.tryInteract();
    }
    this.engine.update(this.player.x, this.player.y);
    this.crowd.update(this.player.x, this.player.y);
    this.minimap.update(this.layout, this.player.x, this.player.y, delta);
    this.updatePerspectiveDebug();
    this.updateCollisionDebug();
    if (this.npcPathDebug.isEnabled()) {
      this.npcPathDebug.update(this.crowd.getPathDebug());
    }
  }

  private rectContains(rect: Rect, x: number, y: number): boolean {
    return (
      x >= rect.x &&
      x <= rect.x + rect.width &&
      y >= rect.y &&
      y <= rect.y + rect.height
    );
  }

  /**
   * Staged-прогрессия дыма (central hall): комбинация времени в комнате,
   * близости игрока к главному маршруту и реакции NPC. Стадии только
   * растут; blocked достигается лишь таймером — игрок всегда успевает
   * увидеть обычный маршрут и осознать изменение.
   */
  private updateSmokeProgression(delta: number): void {
    const prog = this.layout.smokeProgression;
    if (!prog || this.smokeStage === "blocked") return;

    this.smokeRoomMs += delta;
    const currentIdx = smokeStageIndex(this.smokeStage);

    // Целевая стадия по таймерам комнаты.
    let targetIdx = currentIdx;
    if (this.smokeRoomMs >= prog.blockedAfterMs) {
      targetIdx = smokeStageIndex("blocked");
    } else if (this.smokeRoomMs >= prog.mediumAfterMs) {
      targetIdx = smokeStageIndex("medium");
    } else if (this.smokeRoomMs >= prog.lightAfterMs) {
      targetIdx = smokeStageIndex("light");
    } else {
      targetIdx = Math.max(targetIdx, smokeStageIndex("distant"));
    }

    // Близость к главному маршруту ускоряет на одну стадию (не выше medium).
    if (this.rectContains(prog.approachRect, this.player.x, this.player.y)) {
      this.smokeApproachMs += delta;
      if (this.smokeApproachMs >= 800) {
        this.smokeApproachMs = 0;
        targetIdx = Math.max(
          targetIdx,
          Math.min(currentIdx + 1, smokeStageIndex("medium")),
        );
      }
    } else {
      this.smokeApproachMs = 0;
    }

    if (targetIdx > currentIdx) {
      const order: SmokeStage[] = [
        "none",
        "distant",
        "light",
        "medium",
        "blocked",
      ];
      this.advanceSmokeStage(order[targetIdx]);
    }
  }

  /** Повышает стадию дыма и запускает связанные реакции (NPC, аудио, цель). */
  private advanceSmokeStage(stage: SmokeStage): void {
    if (smokeStageIndex(stage) <= smokeStageIndex(this.smokeStage)) return;
    this.smokeStage = stage;
    this.fx.setSmokeStage(stage);

    if (
      smokeStageIndex(stage) >= smokeStageIndex("medium") &&
      !this.redirectFired
    ) {
      this.redirectFired = true;
      this.smokeSeen = true;
      this.engine.dispatchEvent("route_smoke_warning", {
        x: this.player.x,
        y: this.player.y,
      });
      // Не выдаём «идите к запасному» заранее — игрок должен сам оценить ситуацию.
      eventBus.emit("objective:changed", {
        objectiveKey: "game.objectiveHall",
      });
      this.ambientAudio.setState(this.roomAudioState(this.layout.id));
      this.runHallClimaxBeat();
    } else if (
      this.layout.id === "central_hall" &&
      smokeStageIndex(stage) >= smokeStageIndex("light")
    ) {
      // Лёгкий рост напряжения до medium без смены на danger-луп.
      this.ambientAudio.setState("central_hall");
    }
  }

  /**
   * Кульминация холла: NPC стопорятся → учитель реагирует → короткая пауза
   * на оценку → группа уходит к запасному. Зелёный маршрут не показываем.
   */
  private runHallClimaxBeat(): void {
    this.crowd.haltRedirectMilling();
    this.cameras.main.shake(140, 0.0014);
    // Короткий момент самому оценить ситуацию.
    this.controlLockMs = Math.max(this.controlLockMs, 1500);

    this.time.delayedCall(450, () => {
      if (this.layout.id !== "central_hall") return;
      this.crowd.playTeacherHallGesture("teacher_hall");
      this.ambientAudio.playTeacherCue();
      eventBus.emit("scenario:event", {
        id: "teacher_redirected_group",
        messageKey: "game.event.teacherRedirected",
        severity: "info",
      });
    });

    this.time.delayedCall(1600, () => {
      if (this.layout.id !== "central_hall") return;
      this.crowd.triggerRedirect();
    });
  }

  /**
   * Коридор у класса: «оценил обстановку» (assessed_corridor) — только
   * осмысленное поведение, а не сам факт продвижения по коридору:
   *  - короткая заминка на месте (остановился и осмотрелся); или
   *  - подошёл к дальней части и увидел слабый дым (постоял в зоне обзора).
   * Пробежал насквозь без остановки → followed_crowd_without_checking
   * при переходе (см. transitionTo) — эту ошибку можно исправить в холле.
   */
  private updateCorridorAssess(delta: number): void {
    if (
      this.layout.id !== "corridor" ||
      this.corridorAssessed ||
      this.pack.mechanics?.corridorAssess === false
    ) {
      return;
    }

    this.corridorRoomMs += delta;
    this.corridorMinY = Math.min(this.corridorMinY, this.player.y);

    if (!this.moving) this.corridorStillMs += delta;
    else this.corridorStillMs = 0;

    const pausedBriefly = this.corridorStillMs >= 1100;
    const noticedDistantSmoke =
      this.corridorStillMs >= 500 &&
      this.rectContains(
        this.pack.geometry.corridorViewRect,
        this.player.x,
        this.player.y,
      );

    if (!pausedBriefly && !noticedDistantSmoke) return;

    this.corridorAssessed = true;
    this.engine.dispatchEvent("assessed_corridor", {
      x: this.player.x,
      y: this.player.y,
    });
  }

  /**
   * Ветвление central hall: три равноценных источника информации о маршруте
   * (план / знак / указание учителя), awareness-наблюдения и вмешательство
   * учителя при затянувшейся нерешительности. Всё — по фактическому
   * поведению игрока, без модальных окон.
   */
  private updateHallBranching(delta: number): void {
    if (this.layout.id !== "central_hall") return;

    // Знак запасного выхода — только через interaction hotspot (не auto-zone).

    // Дым замечен издалека: стадия light+, игрок далеко от главного выхода.
    if (
      !this.smokeNoticedFar &&
      smokeStageIndex(this.smokeStage) >= smokeStageIndex("light")
    ) {
      const prog = this.layout.smokeProgression;
      const farFromSmoke =
        this.player.y >= this.pack.geometry.hallFarFromSmokeMinY &&
        (!prog ||
          !this.rectContains(prog.approachRect, this.player.x, this.player.y));
      if (farFromSmoke) {
        this.smokeNoticedFarMs += delta;
        if (this.smokeNoticedFarMs >= 800) {
          this.smokeNoticedFar = true;
          this.engine.dispatchEvent("smoke_noticed_from_distance", {
            x: this.player.x,
            y: this.player.y,
          });
        }
      } else {
        this.smokeNoticedFarMs = 0;
      }
    }

    // Затянувшаяся нерешительность после medium: ни одного источника
    // маршрута — учитель подсказывает направление.
    if (this.redirectFired) {
      this.sinceMediumMs += delta;
      if (
        this.sinceMediumMs >= TEACHER_INTERVENTION.indecisionAfterMediumMs &&
        this.scenarioState.routeEvidence.length === 0 &&
        this.scenarioState.teacherInterventions === 0
      ) {
        this.teacherIntervene();
      }
    }
  }

  /**
   * Вмешательство учителя: останавливает движение в опасную сторону
   * (мягкий отскок, без телепорта), локализованная реплика, новая цель.
   * Не повторяется чаще кулдауна; управление остаётся у игрока.
   */
  private teacherIntervene(): void {
    if (this.interventionCooldownMs > 0) return;
    this.interventionCooldownMs = TEACHER_INTERVENTION.cooldownMs;
    this.scenarioState.teacherInterventions += 1;

    this.engine.dispatchEvent("teacher_intervened", {
      x: this.player.x,
      y: this.player.y,
    });
    this.ambientAudio.playTeacherCue();
    eventBus.emit("objective:changed", {
      objectiveKey: "game.objectiveTeacherRoute",
    });
    this.revealSafeRouteHints();

    // Короткая пауза + мягкий отвод от опасной зоны (направление — из пакета).
    const push = this.pack.geometry.interventionPush;
    this.controlLockMs = 700;
    this.tweens.add({
      targets: this.player,
      x: this.player.x + push.x,
      y: Math.min(this.player.y + push.y, this.layout.walk.yBottom - 4),
      duration: 320,
      ease: "Sine.easeOut",
      onUpdate: () => {
        this.player.setScale(this.playerScaleAt(this.player.y));
        this.player.setDepth(this.player.y);
      },
    });
    this.cameras.main.shake(110, 0.0012);
  }

  /** Управление недоступно до первого решения и во время scripted-сцен. */
  private controlsLocked(): boolean {
    return (
      this.scenarioState.firstDecision === null ||
      this.scriptedBusy ||
      this.controlLockMs > 0 ||
      this.awaitingChoice
    );
  }

  // ------------------------------------------------------------- игрок

  private createPlayer(scenario: ScenarioDefinition): void {
    this.player = this.add
      .sprite(scenario.start.x, scenario.start.y, PLAYER_TEX.idle.up)
      .setOrigin(0.5, 1);
  }

  private playerScaleAt(y: number): number {
    const scale = scaleAtDepth(
      this.layout.perspective,
      y,
      this.layout.playerRole,
      this.player.height,
      0.94,
    );
    return this.crouched ? scale * CROUCH_HEIGHT : scale;
  }

  /** Точка ног внутри непроходимой мебели? */
  private blockedAt(x: number, y: number): boolean {
    for (const rect of this.layout.obstacles ?? []) {
      if (
        x >= rect.x &&
        x <= rect.x + rect.width &&
        y >= rect.y &&
        y <= rect.y + rect.height
      ) {
        return true;
      }
    }
    return false;
  }

  /** Фактор замедления в плотной толпе / бонус calm lane. */
  private slowFactorAt(x: number, y: number): number {
    const lane = this.layout.calmLane;
    if (lane && this.rectContains(lane, x, y)) {
      // Свободный проход — заметно плавнее после выбора / и при нахождении в нём.
      return this.scenarioState.tookCalmLane || this.scenarioState.pushedCrowd
        ? 1.12
        : 1.06;
    }
    for (const zone of this.layout.slowZones ?? []) {
      const { rect } = zone;
      if (
        x >= rect.x &&
        x <= rect.x + rect.width &&
        y >= rect.y &&
        y <= rect.y + rect.height
      ) {
        // После перехода в calm lane поток ощущается спокойнее.
        const base = zone.factor;
        return this.scenarioState.tookCalmLane
          ? Math.min(1, base + 0.22)
          : base;
      }
    }
    return 1;
  }

  private updateMovement(delta: number): void {
    const move = this.inputController.getMoveVector();
    const norm = depthNorm(this.layout.perspective, this.player.y);
    const pushSlow = this.stairsPushSlowMs > 0 ? 0.72 : 1;
    const speed =
      PLAYER_SPEED *
      (0.5 + 0.5 * norm) *
      this.slowFactorAt(this.player.x, this.player.y) *
      this.smokeMoveFactor *
      pushSlow *
      (this.crouched ? 0.8 : 1);

    const dt = delta / 1000;
    const dx = move.x * speed * dt;
    const dy = move.y * speed * dt * 0.82;

    // Коллизии мебели: полный шаг → по одной оси → «скольжение» вдоль кромки
    // (небольшой сдвиг по перпендикуляру, чтобы не залипать на углах парт).
    const candidates: Array<{ x: number; y: number }> = [
      { x: this.player.x + dx, y: this.player.y + dy },
      { x: this.player.x + dx, y: this.player.y },
      { x: this.player.x, y: this.player.y + dy },
    ];
    if (dx !== 0) {
      const slide = Math.max(Math.abs(dx), 1.6);
      candidates.push(
        { x: this.player.x + dx, y: this.player.y + slide },
        { x: this.player.x + dx, y: this.player.y - slide },
      );
    }
    if (dy !== 0) {
      const slide = Math.max(Math.abs(dy), 1.6);
      candidates.push(
        { x: this.player.x + slide, y: this.player.y + dy },
        { x: this.player.x - slide, y: this.player.y + dy },
      );
    }

    let next = { x: this.player.x, y: this.player.y };
    for (const candidate of candidates) {
      const clamped = clampToWalk(this.layout.walk, candidate.x, candidate.y);
      if (!this.blockedAt(clamped.x, clamped.y)) {
        next = clamped;
        break;
      }
    }
    this.player.setPosition(next.x, next.y);
    this.player.setScale(this.playerScaleAt(next.y));
    this.player.setDepth(next.y);

    const isMoving = move.lengthSq() > 0.001;
    if (isMoving) {
      const dir: Direction =
        Math.abs(move.x) >= Math.abs(move.y)
          ? move.x > 0
            ? "right"
            : "left"
          : move.y > 0
            ? "down"
            : "up";
      this.direction = dir;
      if (this.crouched) this.applyCrouchPose(true);
      else this.player.anims.play(PLAYER_ANIM[dir], true);
      this.moving = true;
    } else {
      this.stopWalkAnimation();
    }
  }

  private stopWalkAnimation(): void {
    if (!this.moving) return;
    this.moving = false;
    this.player.anims.stop();
    if (this.crouched) {
      this.applyCrouchPose(false);
      return;
    }
    this.player.setTexture(PLAYER_TEX.idle[this.direction]);
    this.player.setOrigin(0.5, 1);
    this.player.setScale(this.playerScaleAt(this.player.y));
  }

  // ------------------------------------------------------------- комнаты

  private loadRoom(
    roomId: RoomId,
    spawnId?: string,
    explicitPos?: { x: number; y: number },
  ): void {
    this.interactions.clearAll();
    for (const obj of this.roomObjects) obj.destroy();
    this.roomObjects = [];
    this.propByKey.clear();
    this.exitMarkers = [];
    this.eventProps = [];
    this.markedExits.clear();

    const nextLayout = this.pack.layouts[roomId];
    if (!nextLayout) {
      throw new Error(`Пакет ${this.pack.id}: нет комнаты ${roomId}`);
    }
    this.layout = nextLayout;
    const layout = this.layout;

    const bg = this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, layout.backgroundKey)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setDepth(0);
    this.roomObjects.push(bg);

    for (const prop of layout.props) {
      const img = this.add
        .image(prop.at.x, prop.at.y, prop.textureKey)
        .setOrigin(0.5, 1)
        .setFlipX(prop.flipX ?? false)
        .setDepth(prop.at.y + (prop.depthBias ?? 0));
      img.setScale(prop.height / img.height);
      this.roomObjects.push(img);
      this.propByKey.set(prop.textureKey, img);
      if (prop.showOnEvents || prop.hideOnEvents || prop.fire) {
        const hidden =
          (prop.showOnEvents &&
            !prop.showOnEvents.some((e) => this.engine.hasEvent(e))) ||
          (prop.hideOnEvents ?? []).some((e) => this.engine.hasEvent(e));
        img.setVisible(!hidden);
        if (prop.fire && !hidden) this.startFireFlicker(img);
        this.eventProps.push({ def: prop, img });
      }
    }

    for (const auto of layout.autoExits) {
      // Auto-exit: нейтральный маркер (не «зелёная стрелка правильного пути»).
      this.addExitMarker(
        auto.rect.x + auto.rect.width / 2,
        auto.rect.y + auto.rect.height * 0.35,
        true,
        "neutral",
      );
    }

    this.refreshInteractables();

    const spawn =
      explicitPos ??
      (spawnId ? layout.spawns[spawnId] : undefined) ??
      Object.values(layout.spawns)[0];
    const clamped = clampToWalk(layout.walk, spawn.x, spawn.y);
    this.player.setPosition(clamped.x, clamped.y);
    this.player.setScale(this.playerScaleAt(clamped.y));
    this.player.setDepth(clamped.y);
    // Поза «пригнувшись» и пелена «в полный рост» живут только в своей комнате.
    this.crouched = false;
    this.uprightInSmoke = false;
    this.player.setAngle(0).setFlipX(false);
    this.direction = roomId === "stairs" ? "left" : "up";
    this.moving = true;
    this.stopWalkAnimation();
    this.player.setTexture(
      roomId === "stairs" ? PLAYER_TEX.idle.left : PLAYER_TEX.idle.up,
    );
    this.player.setScale(this.playerScaleAt(clamped.y));

    this.crowd.build(
      layout,
      this.roomObjects,
      this.interactions,
      this.scenarioState,
      { x: clamped.x, y: clamped.y },
      () => this.offerStudentHelpChoice(),
    );
    this.fx.buildRoomFx(layout, this.roomObjects);

    // Calm lane: без преждевременной зелёной полосы.
    if (
      layout.calmLane &&
      shouldRevealCalmLaneHint({
        pushedCrowd: this.scenarioState.pushedCrowd,
        tookCalmLane: this.scenarioState.tookCalmLane,
        fallbackHint: this.fallbackHint,
      })
    ) {
      this.drawCalmLaneHint(layout.calmLane);
    }

    this.dangerAccum = 0;
    this.dangerWarned = false;
    this.inDangerZone = false;
    this.inSlowZone = false;

    // Staged-дым: при входе в decision-комнату — только distant-стадия.
    this.smokeRoomMs = 0;
    this.smokeApproachMs = 0;
    if (layout.smokeProgression) {
      this.smokeStage = "none";
      this.redirectFired = false;
      this.advanceSmokeStage("distant");
    } else {
      this.smokeStage = "none";
    }

    if (roomId === "corridor") {
      this.corridorStillMs = 0;
      this.corridorRoomMs = 0;
      this.corridorMinY = Number.POSITIVE_INFINITY;
    }

    // Auto-exit не срабатывает в кадр спавна (особенно vestibule / stairs).
    this.roomEnterGraceMs = 700;
    this.npcPathDebug.clear();

    this.engine.setActiveRoom(roomId);
    this.ambientAudio.setState(this.roomAudioState(roomId));
    this.minimap.roomChanged(roomId);
    const objectiveKey =
      [...(layout.objectiveKeyAfter ?? [])]
        .reverse()
        .find((o) => this.engine.hasEvent(o.event))?.key ?? layout.objectiveKey;
    if (objectiveKey) {
      eventBus.emit("objective:changed", { objectiveKey });
    }
    eventBus.emit("scenario:event", {
      id: `enter_${roomId}`,
      messageKey: this.pack.roomEnterMessage[roomId],
      severity: "info",
    });

    // «Выбежал не оценив»: короткая заминка на входе в коридор.
    if (roomId === "corridor" && this.scenarioState.rushNoticePending) {
      this.scenarioState.rushNoticePending = false;
      this.controlLockMs = 1600;
      this.time.delayedCall(350, () => {
        this.engine.dispatchEvent("rush_hesitation", {
          x: this.player.x,
          y: this.player.y,
        });
      });
    }
  }

  /**
   * Регистрирует выходы и хотспоты комнаты, чьи условия выполнены сейчас.
   * Вызывается при входе в комнату и после каждого события сценария:
   * условные объекты (полотенца, телефон, балкон) появляются по ходу игры.
   */
  private refreshInteractables(): void {
    const layout = this.layout;
    const routeHint = shouldRevealSafeRouteHint({
      routeEvidence: this.scenarioState.routeEvidence,
      teacherInterventions: this.scenarioState.teacherInterventions,
      fallbackHint: this.fallbackHint,
    });

    for (const exit of layout.exits) {
      if (!this.conditionsMet(exit)) {
        this.interactions.unregister(exit.id);
        continue;
      }
      this.interactions.register({
        id: exit.id,
        x: exit.at.x,
        y: exit.at.y,
        radius: exit.radius,
        labelKey: exit.labelKey,
        onInteract: () => this.useExit(exit),
      });
      if (this.markedExits.has(exit.id)) continue;
      // Запасной выход в холле — без зелёного маркера до решения игрока.
      if (exit.id === "side_exit_door") {
        if (routeHint) {
          this.markedExits.add(exit.id);
          this.addExitMarker(exit.at.x, exit.at.y, false, "safe");
          this.safeRouteHintShown = true;
        }
      } else {
        this.markedExits.add(exit.id);
        this.addExitMarker(exit.at.x, exit.at.y, false, "safe");
      }
    }

    for (const hotspot of layout.hotspots) {
      const key = `${layout.id}:${hotspot.id}`;
      const used =
        this.usedInteractables.has(key) ||
        (hotspot.once && this.engine.hasEvent(hotspot.scenarioEvent));
      if (used || !this.conditionsMet(hotspot)) {
        this.interactions.unregister(hotspot.id);
        continue;
      }
      this.interactions.register({
        id: hotspot.id,
        x: hotspot.at.x,
        y: hotspot.at.y,
        radius: hotspot.radius,
        labelKey: hotspot.labelKey,
        onInteract: () => {
          if (hotspot.once) {
            this.usedInteractables.add(key);
            this.interactions.unregister(hotspot.id);
          }
          if (hotspot.id === "ask_teacher") {
            // Interaction-label и есть вопрос; ответ учителя — сразу.
            this.applyTeacherAsk();
            return;
          }
          this.engine.dispatchEvent(hotspot.scenarioEvent, hotspot.at);
        },
      });
    }
  }

  private conditionsMet(item: {
    requires?: string;
    requiresNot?: string;
  }): boolean {
    if (item.requires && !this.engine.hasEvent(item.requires)) return false;
    if (item.requiresNot && this.engine.hasEvent(item.requiresNot)) {
      return false;
    }
    return true;
  }

  /** Переход через выход: проверки, событие, при необходимости — пауза. */
  private useExit(exit: RoomExit): void {
    if (this.transitioning || this.exitBeatPending) return;
    const layout = this.layout;
    if (exit.scenarioEvent !== exit.telemetryEvent) {
      this.telemetry.record(exit.telemetryEvent, this.player.x, this.player.y, {
        room: layout.id,
      });
    }
    if (exit.warnIfMissing && !this.engine.hasEvent(exit.warnIfMissing.event)) {
      this.engine.dispatchEvent(exit.warnIfMissing.riskEvent, exit.at);
    }
    if (exit.telemetryEvent === "used_emergency_exit") {
      this.engine.dispatchEvent("used_emergency_exit", exit.at);
    }
    if (exit.scenarioEvent) {
      this.engine.dispatchEvent(exit.scenarioEvent, exit.at);
    }
    if (!exit.beat) {
      this.transitionTo(exit.target, exit.spawn);
      return;
    }
    // Пауза-ожидание: игрок подходит к двери, сообщение, затем переход.
    const beat = exit.beat;
    this.exitBeatPending = true;
    this.controlLockMs = beat.ms + 600;
    this.interactions.clearAll();
    this.stopWalkAnimation();
    this.tweens.add({
      targets: this.player,
      x: exit.at.x,
      y: exit.at.y,
      duration: 700,
      ease: "Sine.easeInOut",
      onUpdate: () => {
        this.player.setScale(this.playerScaleAt(this.player.y));
        this.player.setDepth(this.player.y);
      },
    });
    eventBus.emit("scenario:event", {
      id: `beat_${exit.id}`,
      messageKey: beat.messageKey,
      severity: "info",
    });
    this.time.delayedCall(beat.ms, () => {
      this.exitBeatPending = false;
      this.transitionTo(exit.target, exit.spawn);
    });
  }

  /** Пропы, которые появляются/исчезают по событию (крышка, полотенца). */
  private applyEventProps(eventId: string): void {
    for (const { def, img } of this.eventProps) {
      if (def.fire) continue; // огонь гасит/раздувает первое решение
      if (def.showOnEvents?.includes(eventId) && !img.visible) {
        img.setVisible(true).setAlpha(0);
        this.tweens.add({
          targets: img,
          alpha: 1,
          delay: def.showDelayMs ?? 0,
          duration: 420,
        });
      }
      if (def.hideOnEvents?.includes(eventId) && img.visible) {
        this.tweens.add({
          targets: img,
          alpha: 0,
          duration: 320,
          onComplete: () => img.setVisible(false),
        });
      }
    }
  }

  private startFireFlicker(img: Phaser.GameObjects.Image): void {
    const base = img.scaleX;
    this.tweens.add({
      targets: img,
      scaleY: { from: base * 0.92, to: base * 1.1 },
      scaleX: { from: base * 1.03, to: base * 0.96 },
      alpha: { from: 0.86, to: 1 },
      duration: 170,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  /**
   * Огонь на плите после первого решения: крышка — пламя гаснет без
   * кислорода; вода — вспышка до потолка, затем огонь опадает.
   */
  private extinguishFire(flare: boolean): void {
    for (const { def, img } of this.eventProps) {
      if (!def.fire || !img.visible) continue;
      this.tweens.killTweensOf(img);
      const base = def.height / img.height;
      img.setScale(base).setAlpha(1);
      const puffY = img.y - img.displayHeight * 0.7;
      if (flare) {
        this.cameras.main.flash(320, 255, 170, 80);
        this.cameras.main.shake(420, 0.006);
        this.tweens.add({
          targets: img,
          scaleX: base * 2.4,
          scaleY: base * 3.4,
          duration: 240,
          ease: "Quad.easeOut",
          onComplete: () =>
            this.tweens.add({
              targets: img,
              alpha: 0,
              scaleX: base * 1.2,
              scaleY: base * 1.1,
              delay: 700,
              duration: 1500,
              onComplete: () => img.setVisible(false),
            }),
        });
        this.puffSmoke(img.x, puffY - 60, 1.7);
      } else {
        this.tweens.add({
          targets: img,
          alpha: 0,
          scaleY: base * 0.35,
          duration: 520,
          ease: "Sine.easeIn",
          onComplete: () => img.setVisible(false),
        });
        this.puffSmoke(img.x, puffY, 0.8);
      }
    }
  }

  private puffSmoke(x: number, y: number, scale: number): void {
    const puff = this.add
      .image(x, y, `${FX_TEX.smokeLightPrefix}1`)
      .setDepth(y + 400)
      .setAlpha(0)
      .setScale(scale * 0.4);
    this.roomObjects.push(puff);
    this.tweens.add({
      targets: puff,
      alpha: { from: 0.75, to: 0 },
      y: y - 140,
      scale: scale,
      duration: 2400,
      ease: "Sine.easeOut",
      onComplete: () => puff.destroy(),
    });
  }

  /** Вход в зону выбора: короткий вопрос, управление ждёт ответа. */
  private updateChoiceZones(): void {
    for (const zone of this.layout.choiceZones ?? []) {
      if (this.choiceZonesDone.has(zone.id)) continue;
      if (!this.rectContains(zone.rect, this.player.x, this.player.y)) continue;
      this.choiceZonesDone.add(zone.id);
      this.awaitingChoice = true;
      this.stopWalkAnimation();
      eventBus.emit("choice:offer", {
        id: `zone:${zone.id}`,
        promptKey: zone.promptKey,
        options: zone.options.map((o) => ({ id: o.id, labelKey: o.labelKey })),
      });
      return;
    }
  }

  private applyZoneChoice(zoneId: string, optionId: string): void {
    this.awaitingChoice = false;
    const zone = this.layout.choiceZones?.find((z) => z.id === zoneId);
    const option = zone?.options.find((o) => o.id === optionId);
    if (!option) return;
    this.engine.dispatchEvent(option.event, {
      x: this.player.x,
      y: this.player.y,
    });
    if (option.effect === "crouch") {
      this.crouched = true;
      this.applyCrouchPose(false);
    } else if (option.effect === "upright") {
      this.uprightInSmoke = true;
      this.cameras.main.shake(160, 0.002);
    }
  }

  /** Поза «пригнувшись, рот закрыт тканью»: один кадр + покачивание. */
  private applyCrouchPose(moving: boolean): void {
    const side = this.direction !== "up";
    this.player.anims.stop();
    this.player.setTexture(
      side ? PLAYER_TEX.crouch.side : PLAYER_TEX.crouch.back,
    );
    this.player.setFlipX(this.direction === "right");
    this.player.setOrigin(0.5, 1);
    this.player.setAngle(moving ? Math.sin(this.time.now / 90) * 2.5 : 0);
    this.player.setScale(this.playerScaleAt(this.player.y));
  }

  private addExitMarker(
    x: number,
    y: number,
    auto: boolean,
    style: "safe" | "neutral" = "safe",
  ): void {
    const color = style === "safe" ? 0x2fae5f : 0xb8c0cc;
    const ring = this.add
      .circle(x, y, auto ? 24 : 20, color, style === "safe" ? 0.18 : 0.1)
      .setStrokeStyle(2, color, style === "safe" ? 0.55 : 0.35)
      .setDepth(y - 2);
    if (style === "safe") {
      this.tweens.add({
        targets: ring,
        alpha: { from: 0.35, to: 0.85 },
        scale: { from: 0.92, to: 1.08 },
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
    this.roomObjects.push(ring);
    this.exitMarkers.push(ring);

    if (auto && style === "safe") {
      const chevron = this.add
        .text(x, y - 36, "▼", {
          fontSize: "22px",
          color: "#2fae5f",
        })
        .setOrigin(0.5)
        .setDepth(y + 2)
        .setAlpha(0.85);
      this.tweens.add({
        targets: chevron,
        y: y - 44,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
      this.roomObjects.push(chevron);
      this.exitMarkers.push(chevron);
    }
  }

  private drawCalmLaneHint(lane: Rect): void {
    if (this.calmLaneHintShown) return;
    this.calmLaneHintShown = true;
    const strip = this.add
      .rectangle(
        lane.x + lane.width / 2,
        lane.y + lane.height / 2,
        lane.width,
        lane.height,
        0x2fae5f,
        0.13,
      )
      .setStrokeStyle(1, 0x2fae5f, 0.4)
      .setDepth(1);
    this.tweens.add({
      targets: strip,
      alpha: { from: 0.75, to: 1 },
      duration: 1300,
      yoyo: true,
      repeat: -1,
    });
    this.roomObjects.push(strip);
  }

  /** После plan / sign / ask teacher / intervention / fallback. */
  private revealSafeRouteHints(): void {
    if (this.safeRouteHintShown) return;
    if (this.layout.id !== "central_hall") return;
    this.safeRouteHintShown = true;
    const exit = this.layout.exits.find((e) => e.id === "side_exit_door");
    if (exit) this.addExitMarker(exit.at.x, exit.at.y, false, "safe");
    eventBus.emit("objective:changed", {
      objectiveKey:
        this.scenarioState.teacherInterventions > 0
          ? "game.objectiveTeacherRoute"
          : "game.objectiveSideRoute",
    });
    // После решения маршрута — заметная смена звуковой сцены.
    if (
      smokeStageIndex(this.smokeStage) >= smokeStageIndex("medium") &&
      !this.inDangerZone
    ) {
      this.ambientAudio.setState("side_corridor");
    }
    // Если толпа ещё топчется — подтолкнуть разворот после выбора игрока.
    if (this.redirectFired) {
      this.crowd.triggerRedirect();
    }
  }

  private offerStudentHelpChoice(): void {
    if (this.scenarioState.studentHelpChoice !== null) return;
    const help = this.pack.helpChoice ?? DEFAULT_HELP_CHOICE;
    eventBus.emit("choice:offer", {
      id: "help_student",
      promptKey: help.promptKey,
      options: help.options,
    });
  }

  private applyStudentHelpChoice(optionId: string): void {
    if (this.scenarioState.studentHelpChoice !== null) return;
    if (optionId === "companion") {
      this.scenarioState.studentHelpChoice = "companion";
      this.crowd.acceptPendingCompanion(this.player.x, this.player.y);
      this.engine.dispatchEvent("helped_student", {
        x: this.player.x,
        y: this.player.y,
      });
      return;
    }
    if (optionId === "referred") {
      this.scenarioState.studentHelpChoice = "referred";
      this.crowd.referPendingToTeacher("teacher_assessing");
      this.engine.dispatchEvent("student_referred_to_teacher", {
        x: this.player.x,
        y: this.player.y,
      });
      return;
    }
    this.scenarioState.studentHelpChoice = "declined";
    this.crowd.dismissPendingHelp();
    this.engine.dispatchEvent("student_help_declined", {
      x: this.player.x,
      y: this.player.y,
    });
  }

  private applyTeacherAsk(): void {
    addRouteEvidence(this.scenarioState, "teacher_instruction");
    this.engine.dispatchEvent("teacher_instruction_followed", {
      x: this.player.x,
      y: this.player.y,
    });
    this.ambientAudio.playTeacherCue();
    this.crowd.playTeacherHallGesture("teacher_hall");
    this.revealSafeRouteHints();
    if (
      this.layout.id === "central_hall" &&
      smokeStageIndex(this.smokeStage) >= smokeStageIndex("medium") &&
      !this.inDangerZone
    ) {
      this.ambientAudio.setState("side_corridor");
    }
  }

  /**
   * После доклада учителю: 3–5 с финальный момент, затем debrief.
   * Companion присоединяется к группе, если была спасена.
   */
  private runOutdoorCompletionBeat(): void {
    this.controlLockMs = 5000;
    this.ambientAudio.beginOutdoorCalm();
    this.crowd.playAssemblyTeacherAck("assembly_teacher");

    if (
      this.scenarioState.companionActive &&
      !this.scenarioState.companionReachedAssembly
    ) {
      this.crowd.joinCompanionToAssemblyGroup();
    } else if (this.scenarioState.companionReachedAssembly) {
      // Уже на точке сбора — короткая реакция «на месте».
      this.crowd.markCompanionReachedAssembly();
    }

    eventBus.emit("scenario:completion_beat", {
      messageKey: "game.event.evacuationComplete",
    });

    this.time.delayedCall(4200, () => {
      this.engine.finishPendingCompletion();
    });
  }

  /** Fallback: мягкая подсказка только при реальной «застревании». */
  private updateFallbackHints(delta: number): void {
    if (this.layout.id === "corridor") {
      if (!this.moving) this.corridorIdleMs += delta;
      else this.corridorIdleMs = 0;
      if (
        this.corridorIdleMs >= FALLBACK_HINT.corridorMs &&
        !this.fallbackHint
      ) {
        this.fallbackHint = true;
        eventBus.emit("scenario:event", {
          id: "fallback_corridor",
          messageKey: "game.event.fallbackExplore",
          severity: "info",
        });
      }
    }

    if (this.layout.id === "central_hall" && this.redirectFired) {
      if (
        this.sinceMediumMs >= FALLBACK_HINT.hallAfterMediumMs &&
        this.scenarioState.routeEvidence.length === 0 &&
        this.scenarioState.teacherInterventions === 0 &&
        !this.safeRouteHintShown
      ) {
        this.fallbackHint = true;
        this.revealSafeRouteHints();
        eventBus.emit("scenario:event", {
          id: "fallback_hall",
          messageKey: "game.event.fallbackCheckSources",
          severity: "info",
        });
      }
    }

    if (this.layout.id === "stairs" && this.layout.calmLane) {
      const towardExit =
        this.player.x < this.pack.geometry.stairsTowardExitMaxX;
      if (!this.moving || towardExit) this.stairsIdleMs += delta;
      else this.stairsIdleMs = 0;
      if (
        this.stairsIdleMs >= FALLBACK_HINT.stairsMs &&
        !this.calmLaneHintShown &&
        !this.scenarioState.tookCalmLane
      ) {
        this.fallbackHint = true;
        this.drawCalmLaneHint(this.layout.calmLane);
      }
    }
  }

  /** Звуковое состояние комнаты с учётом прогресса сценария. */
  private roomAudioState(
    roomId: RoomId,
  ):
    | "alarm_start"
    | "classroom_evacuation"
    | "corridor"
    | "central_hall"
    | "smoke_danger"
    | "side_corridor"
    | "stairs"
    | "vestibule"
    | "outdoor" {
    switch (roomId) {
      case "classroom":
        return this.scenarioState.firstDecision === null
          ? "alarm_start"
          : "classroom_evacuation";
      case "corridor":
        return "corridor";
      case "central_hall":
        // denser crowd в холле; tension layer — с medium (redirect).
        return smokeStageIndex(this.smokeStage) >= smokeStageIndex("medium")
          ? "smoke_danger"
          : "central_hall";
      case "stairs":
        return "stairs";
      case "vestibule":
        return "vestibule";
      case "outdoor":
        return "outdoor";
    }
  }

  /** Вход в плотную группу на лестнице: мягкий звук замедления, без «боли». */
  private updateCrowdSqueezeAudio(): void {
    const inSlow = this.slowFactorAt(this.player.x, this.player.y) < 1;
    if (inSlow && !this.inSlowZone) this.ambientAudio.playCrowdBump();
    this.inSlowZone = inSlow;
  }

  private transitionTo(target: RoomId, spawnId: string): void {
    if (this.transitioning) return;
    this.transitioning = true;

    // Образовательные сигналы на переходах между комнатами.
    if (this.layout.id === "corridor" && target === "central_hall") {
      // Пробежал коридор без заминки — пошёл за потоком не оценив.
      if (
        !this.corridorAssessed &&
        this.pack.mechanics?.corridorAssess !== false
      ) {
        this.engine.dispatchEvent("followed_crowd_without_checking", {
          x: this.player.x,
          y: this.player.y,
        });
      }
    }
    if (this.layout.id === "central_hall" && target === "stairs") {
      // Сменил привычный маршрут после появления дыма — правильное действие.
      if (this.smokeSeen) {
        this.engine.dispatchEvent("changed_route_after_smoke", {
          x: this.player.x,
          y: this.player.y,
        });
      }
      // Каким источником игрок понял маршрут? План/знак записаны раньше.
      // Без них: слышал указание учителя (redirect) и хоть раз оценивал
      // обстановку сам → «следовал указанию»; вообще без проверки →
      // «шёл только за толпой».
      // Без plan/sign/ask_teacher — следование за толпой (не «тихое» указание).
      if (
        this.scenarioState.routeEvidence.length === 0 &&
        this.scenarioState.teacherInterventions === 0
      ) {
        this.engine.dispatchEvent("crowd_following_route", {
          x: this.player.x,
          y: this.player.y,
        });
      }
    }
    if (this.layout.id === "stairs" && target === "vestibule") {
      // Нейтральный спуск общим потоком: без толкотни и без calm lane.
      if (!this.scenarioState.pushedCrowd && !this.scenarioState.tookCalmLane) {
        this.engine.dispatchEvent("stairs_flow_used", {
          x: this.player.x,
          y: this.player.y,
        });
      }
    }

    this.ambientAudio.playDoor();
    const camera = this.cameras.main;
    camera.fadeOut(380, 6, 11, 20);
    camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.loadRoom(target, spawnId);
      camera.fadeIn(420, 6, 11, 20);
      this.time.delayedCall(40, () => {
        this.transitioning = false;
      });
    });
  }

  private checkAutoExits(): void {
    for (const auto of this.layout.autoExits) {
      const { rect } = auto;
      if (
        this.player.x >= rect.x &&
        this.player.x <= rect.x + rect.width &&
        this.player.y >= rect.y &&
        this.player.y <= rect.y + rect.height
      ) {
        this.telemetry.record(
          auto.telemetryEvent,
          this.player.x,
          this.player.y,
          { room: this.layout.id },
        );
        this.transitionTo(auto.target, auto.spawn);
        return;
      }
    }
  }

  private updateDangerLinger(delta: number): void {
    const danger = this.layout.dangerZone;
    if (!danger) return;
    const { rect } = danger;
    const inside =
      this.player.x >= rect.x &&
      this.player.x <= rect.x + rect.width &&
      this.player.y >= rect.y &&
      this.player.y <= rect.y + rect.height;

    // Звуковая зона дыма: вход — плотное напряжение; выход — состояние комнаты.
    if (inside && !this.inDangerZone) {
      this.inDangerZone = true;
      this.smokeSeen = true;
      this.dangerVisitMs = 0;
      this.ambientAudio.setState("smoke_danger");
      // Повторный подход после предупреждения — учитель останавливает.
      if (this.dangerWarned && TEACHER_INTERVENTION.reapproachAfterWarning) {
        this.teacherIntervene();
      }
    } else if (!inside && this.inDangerZone) {
      this.inDangerZone = false;
      this.ambientAudio.setState(this.roomAudioState(this.layout.id));
      // Отошёл сам (до вмешательства учителя) после осмысленного подхода —
      // исправленная ошибка: риск остаётся в истории, но весит меньше.
      if (
        this.dangerVisitMs >= CORRECTION_POLICY.smokeApproachMinMs &&
        this.scenarioState.teacherInterventions === 0 &&
        !this.smokeApproachCorrectedFired
      ) {
        this.smokeApproachCorrectedFired = true;
        this.engine.dispatchEvent("smoke_approach_corrected", {
          x: this.player.x,
          y: this.player.y,
        });
      }
    }

    if (!inside) {
      this.dangerAccum = 0;
      return;
    }
    this.dangerVisitMs += delta;
    this.dangerAccum += delta;
    if (this.dangerAccum >= danger.lingerMs && !this.dangerWarned) {
      this.dangerWarned = true;
      this.engine.dispatchEvent(danger.lingerEvent, {
        x: this.player.x,
        y: this.player.y,
      });
      this.cameras.main.shake(220, 0.0028);
    }
    // Продолжает стоять у дыма после предупреждения — вмешательство.
    if (
      this.dangerWarned &&
      this.dangerAccum >=
        danger.lingerMs + TEACHER_INTERVENTION.lingerBeyondWarningMs
    ) {
      this.teacherIntervene();
    }
  }

  /**
   * Дым: близость → лёгкая пелена; linger → приглушённый звук + небольшое
   * замедление; самостоятельный отход → эффекты быстро слабеют.
   */
  private updateSmokeProximityFeel(delta: number): void {
    if (this.layout.id !== "central_hall" || !this.layout.dangerZone) {
      // Вне холла: пелена только у «идущего в полный рост» в дыму.
      const targetMuffle = this.uprightInSmoke ? 0.55 : 0;
      const targetMove = this.uprightInSmoke ? 0.8 : 1;
      if (
        this.smokeMoveFactor !== targetMove ||
        this.smokeMuffle !== targetMuffle
      ) {
        const step = delta / 350;
        this.smokeMoveFactor += Phaser.Math.Clamp(
          targetMove - this.smokeMoveFactor,
          -step,
          step,
        );
        this.smokeMuffle += Phaser.Math.Clamp(
          targetMuffle - this.smokeMuffle,
          -step,
          step,
        );
        this.fx.setSmokeProximity(
          this.smokeMuffle * (this.uprightInSmoke ? 1.1 : 0.5),
        );
        this.ambientAudio.setSmokeMuffle(this.smokeMuffle);
      }
      return;
    }

    const { rect } = this.layout.dangerZone;
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const dist = Math.hypot(this.player.x - cx, this.player.y - cy);
    const near = dist < 220 ? Phaser.Math.Clamp(1 - dist / 220, 0, 1) : 0;

    let targetMuffle = near * 0.35;
    let targetMove = 1 - near * 0.12;
    if (this.inDangerZone) {
      const linger = Math.min(1, this.dangerVisitMs / 1600);
      targetMuffle = Math.max(targetMuffle, 0.45 + linger * 0.35);
      targetMove = Math.min(targetMove, 0.78 - linger * 0.08);
    }

    // Отход — быстрее, чем нарастание.
    const recover = !this.inDangerZone && near < 0.2;
    const rate = recover ? delta / 320 : delta / 700;
    this.smokeMuffle +=
      (targetMuffle - this.smokeMuffle) * Math.min(1, rate * 3);
    this.smokeMoveFactor +=
      (targetMove - this.smokeMoveFactor) * Math.min(1, rate * 3);

    this.fx.setSmokeProximity(Math.max(near * 0.7, this.smokeMuffle * 0.85));
    this.ambientAudio.setSmokeMuffle(this.smokeMuffle);
  }

  // ------------------------------------------------------- первое решение

  /**
   * Применяет выбранный вариант первого решения. Часы сценария стартуют
   * только здесь — интро и раздумья не тратят 180 секунд.
   */
  private applyFirstDecision(optionId: string): void {
    if (this.scenarioState.firstDecision !== null) return;
    const scenario = this.registry.get(
      REGISTRY_SCENARIO_KEY,
    ) as ScenarioDefinition;
    const option = scenario.introDecision.options.find(
      (o) => o.id === optionId,
    );
    if (!option) return;

    this.scenarioState.firstDecision = option.id;
    // Клик по варианту — пользовательский жест: последний шанс включить звук.
    this.ambientAudio.ensureUnlocked();
    void audioManager.playOneShot([AUDIO_FILES.uiClick], "ui", 0.25);
    // Класс приходит в движение: стулья, шаги, дверь.
    this.ambientAudio.setState("classroom_evacuation");
    this.engine.dispatchEvent(option.event, {
      x: this.player.x,
      y: this.player.y,
    });

    const effect = option.effect ?? option.id;
    // Огонь на плите (квартира): крышка гасит, вода раздувает вспышку.
    this.extinguishFire(effect === "flare");

    switch (effect) {
      case "flare":
        // Вода на горящее масло: вспышка, отскок, потерянное время.
        this.engine.addPenaltyMs(6000);
        this.engine.startClock();
        this.crowd.beginEvacuation();
        break;
      case "calm":
        // Спокойная реакция: без штрафа, класс организованно выходит.
        this.engine.startClock();
        this.crowd.beginEvacuation();
        break;
      case "assess":
        // Оценка обстановки: мини-карта получает подсказку (Minimap слушает
        // событие assessed_environment), штрафа нет.
        this.engine.startClock();
        this.crowd.beginEvacuation();
        break;
      case "rush":
        // Выбежал раньше всех, но без оценки — заминка на входе в коридор.
        this.scenarioState.rushNoticePending = true;
        this.engine.startClock();
        this.crowd.beginEvacuation();
        break;
      case "backpack":
        // Возврат за вещами: scripted-проход к рюкзаку и обратно + штраф.
        this.runBackpackScript();
        break;
    }
  }

  /** Scripted: игрок идёт к рюкзаку, берёт его и возвращается (≈8 c штрафа). */
  private runBackpackScript(): void {
    this.scriptedBusy = true;
    const startX = this.player.x;
    const startY = this.player.y;
    const { textureKey, fallback } = this.pack.geometry.backpack;
    const bag = this.propByKey.get(textureKey);
    const bagX = bag?.x ?? fallback.x;
    const bagY = bag?.y ?? fallback.y;

    this.interactions.unregister("backpack");
    this.usedInteractables.add(`${this.layout.id}:backpack`);
    this.player.anims.play(PLAYER_ANIM.left, true);
    this.tweens.add({
      targets: this.player,
      x: bagX + 26,
      y: bagY - 4,
      duration: 950,
      ease: "Sine.easeInOut",
      onUpdate: () => {
        this.player.setScale(this.playerScaleAt(this.player.y));
        this.player.setDepth(this.player.y);
      },
      onComplete: () => {
        // Подобрал рюкзак
        if (bag) {
          this.tweens.add({
            targets: bag,
            alpha: 0,
            duration: 240,
            onComplete: () => bag.setVisible(false),
          });
        }
        this.time.delayedCall(420, () => {
          this.player.anims.play(PLAYER_ANIM.right, true);
          this.tweens.add({
            targets: this.player,
            x: startX,
            y: startY,
            duration: 950,
            ease: "Sine.easeInOut",
            onUpdate: () => {
              this.player.setScale(this.playerScaleAt(this.player.y));
              this.player.setDepth(this.player.y);
            },
            onComplete: () => {
              this.scriptedBusy = false;
              this.moving = true;
              this.direction = "up";
              this.stopWalkAnimation();
              // Потерянное время: штраф к 180-секундным часам.
              this.engine.addPenaltyMs(8000);
              this.engine.startClock();
              this.crowd.beginEvacuation();
            },
          });
        });
      },
    });
  }

  private updateCollisionDebug(): void {
    if (!this.collisionDebug.isEnabled()) return;
    this.collisionDebug.update(
      this.layout,
      this.player.x,
      this.player.y,
      this.interactions.getAll(),
    );
  }

  private updatePerspectiveDebug(): void {
    if (!this.perspectiveDebug.isEnabled()) return;
    this.perspectiveDebug.update(this.layout, [
      {
        id: "player",
        x: this.player.x,
        y: this.player.y,
        role: this.layout.playerRole,
        textureHeight: this.player.height,
        figureFill: 0.94,
      },
      ...this.crowd.getDebugSubjects(),
    ]);
  }

  private setupCamera(): void {
    const camera = this.cameras.main;
    camera.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);
    camera.setZoom(BASE_ZOOM);
    camera.startFollow(this.player, false, 0.08, 0.08);
    camera.setBackgroundColor(0x060b14);
  }

  private setupTimer(scenario: ScenarioDefinition): void {
    this.totalMs = scenario.durationSeconds * 1000;
    eventBus.emit("timer:changed", {
      remainingMs: this.totalMs,
      totalMs: this.totalMs,
    });

    this.time.addEvent({
      delay: 250,
      loop: true,
      callback: () => {
        const remaining = Phaser.Math.Clamp(
          this.totalMs - this.engine.elapsedMs(),
          0,
          this.totalMs,
        );
        eventBus.emit("timer:changed", {
          remainingMs: remaining,
          totalMs: this.totalMs,
        });
        if (remaining <= 0 && !this.timeUpFired && !this.engine.isCompleted()) {
          this.timeUpFired = true;
          this.engine.dispatchEvent("time_up", {
            x: this.player.x,
            y: this.player.y,
          });
        }
      },
    });
  }

  private wireEvents(): void {
    this.events.on(SCENARIO_LOCAL_EVENT, (eventId: string) => {
      this.applyEventProps(eventId);
      this.refreshInteractables();
      if (eventId === "smoke_detected") {
        this.fx.setAlarmActive(true);
        this.cameras.main.shake(180, 0.002);
        this.smokeSeen = true;
      }
      if (eventId === "backpack_note") {
        const bag = this.propByKey.get(this.pack.geometry.backpack.textureKey);
        if (bag) {
          this.tweens.add({
            targets: bag,
            alpha: 0,
            duration: 280,
            onComplete: () => bag.setVisible(false),
          });
        }
      }
      if (eventId === "helped_student") {
        this.scenarioState.helpedStudent = true;
        this.scenarioState.companionActive = true;
      }
      if (
        eventId === "evacuation_plan_checked" ||
        eventId === "safe_exit_sign_detected"
      ) {
        if (eventId === "safe_exit_sign_detected") this.signDetected = true;
        addRouteEvidence(
          this.scenarioState,
          eventId === "evacuation_plan_checked"
            ? "evacuation_plan"
            : "safe_exit_sign",
        );
        this.revealSafeRouteHints();
        if (
          this.layout.id === "central_hall" &&
          smokeStageIndex(this.smokeStage) >= smokeStageIndex("medium") &&
          !this.inDangerZone
        ) {
          this.ambientAudio.setState("side_corridor");
        }
        if (
          this.scenarioState.followedCrowdCorridor &&
          !this.crowdCorrectedFired
        ) {
          this.crowdCorrectedFired = true;
          this.engine.dispatchEvent("crowd_following_corrected", {
            x: this.player.x,
            y: this.player.y,
          });
        }
      }
      if (eventId === "followed_crowd_without_checking") {
        this.scenarioState.followedCrowdCorridor = true;
      }
      if (eventId === "pushed_through_crowd") {
        this.scenarioState.pushedCrowd = true;
        this.stairsPushSlowMs = 900;
        this.crowd.reactToCrowdPush("landing_group");
        this.ambientAudio.playCrowdBump();
        this.cameras.main.shake(100, 0.0016);
        if (this.layout.calmLane) this.drawCalmLaneHint(this.layout.calmLane);
      }
      if (eventId === "took_calm_lane") {
        this.scenarioState.tookCalmLane = true;
        this.stairsPushSlowMs = 0;
        if (this.layout.calmLane) this.drawCalmLaneHint(this.layout.calmLane);
        if (this.scenarioState.pushedCrowd) {
          this.engine.dispatchEvent("stairs_pushing_corrected", {
            x: this.player.x,
            y: this.player.y,
          });
        }
      }
      if (eventId === "companion_safe") {
        this.crowd.markCompanionReachedAssembly();
      }
      if (eventId === "attempted_reentry") {
        // После эвакуации в здание не возвращаются: мягкий отскок от дверей.
        this.tweens.add({
          targets: this.player,
          x: this.player.x + this.pack.geometry.reentryPushX,
          duration: 280,
          ease: "Sine.easeOut",
          onUpdate: () => {
            this.player.setScale(this.playerScaleAt(this.player.y));
            this.player.setDepth(this.player.y);
          },
        });
        this.cameras.main.shake(120, 0.0015);
      }
      if (eventId === "reached_assembly") {
        // Финальный шаг: доложить учителю, что вышли.
        eventBus.emit("objective:changed", {
          objectiveKey: "game.objectiveReport",
        });
      }
    });

    this.busUnsubscribes.push(
      eventBus.on("decision:choose", ({ optionId }) =>
        this.applyFirstDecision(optionId),
      ),
    );

    this.busUnsubscribes.push(
      eventBus.on("choice:resolve", ({ id, optionId }) => {
        if (id === "help_student") this.applyStudentHelpChoice(optionId);
        else if (id.startsWith("zone:")) {
          this.applyZoneChoice(id.slice("zone:".length), optionId);
        }
      }),
    );

    this.events.on(SCENARIO_LOCAL_COMPLETION_PENDING, () => {
      this.runOutdoorCompletionBeat();
    });

    this.events.on(
      SCENARIO_LOCAL_COMPLETED,
      (payload: ScenarioCompletedLocalPayload) => {
        // Успех: chime → спокойная музыка, двор фоном. Таймаут: нейтральный
        // тихий сигнал, никакой победной музыки.
        if (payload.success) {
          this.ambientAudio.playSuccessSequence();
        } else {
          this.ambientAudio.playTimeoutSequence();
        }
        this.time.delayedCall(500, () => {
          this.scene.launch("DebriefScene", {
            success: payload.success,
            timeMs: payload.timeMs,
            exitId: payload.exitId,
          });
          this.scene.pause();
        });
      },
    );

    this.busUnsubscribes.push(
      eventBus.on("game:pause", () => {
        // Duck до scene.pause: лупы не останавливаются, resume без дублей.
        this.ambientAudio.setPaused(true);
        if (!this.scene.isPaused()) this.scene.pause();
      }),
      eventBus.on("game:resume", () => {
        this.ambientAudio.setPaused(false);
        if (this.scene.isPaused()) this.scene.resume();
      }),
      eventBus.on("game:restart", () => {
        if (this.scene.isActive("DebriefScene")) {
          this.scene.stop("DebriefScene");
        }
        this.ambientAudio.reset();
        this.crowd.destroyCompanion();
        this.perspectiveDebug.clear();
        this.collisionDebug.clear();
        this.npcPathDebug.clear();
        this.scene.restart();
      }),
      eventBus.on("audio:toggled", ({ enabled }) => {
        this.telemetry.record(
          enabled ? "sound_enabled" : "sound_disabled",
          this.player.x,
          this.player.y,
        );
      }),
    );

    // Уборка и при restart сцены (SHUTDOWN), и при уничтожении игры (DESTROY):
    // game.destroy() на анмаунте Canvas шлёт только DESTROY. Без этого
    // подписки сцены на шину переживали игру и перехватывали первое решение
    // следующей (переход школа → ТРЦ, «На главную» → снова в игру).
    const teardown = () => {
      this.events.off(Phaser.Scenes.Events.SHUTDOWN, teardown);
      this.events.off(Phaser.Scenes.Events.DESTROY, teardown);
      if (this.tornDown) return;
      this.tornDown = true;
      this.busUnsubscribes.forEach((off) => off());
      this.busUnsubscribes = [];
      this.events.off(SCENARIO_LOCAL_EVENT);
      this.events.off(SCENARIO_LOCAL_COMPLETED);
      this.perspectiveDebug.clear();
      this.collisionDebug.clear();
      this.npcPathDebug.clear();
      // Restart сцены сам выставит новое состояние; при выгрузке игры
      // (анмаунт Canvas) все лупы останавливаются, контекст переиспользуется.
      this.ambientAudio.destroy();
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, teardown);
    this.events.once(Phaser.Scenes.Events.DESTROY, teardown);
  }
}
