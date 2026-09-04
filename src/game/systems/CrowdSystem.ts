import Phaser from "phaser";
import { NPC_TEX } from "../assets";
import type { ScenarioState } from "../scenario/state";
import type { FigureRole, RoomLayout, RoomNpc } from "../rooms/types";
import { scaleAtDepth } from "../rooms/walk";
import type { InteractionSystem } from "./InteractionSystem";

type NpcState = "idle" | "evacuating" | "confused" | "following" | "safe";

interface CrowdMember {
  def: RoomNpc;
  image: Phaser.GameObjects.Image;
  state: NpcState;
  textureHeight: number;
  /** текущая цель движения (для ?debugNpcPaths=1) */
  currentTarget?: { x: number; y: number };
  /** redirect-NPC уже развернулся к запасному выходу */
  redirected?: boolean;
}

/** Данные для оверлея ?debugNpcPaths=1. */
export interface NpcPathDebug {
  id: string;
  routeId?: string;
  x: number;
  y: number;
  waypoints?: Array<{ x: number; y: number }>;
  currentTarget?: { x: number; y: number };
}

export interface CrowdDebugSubject {
  id: string;
  x: number;
  y: number;
  role: FigureRole;
  textureHeight: number;
  figureFill?: number;
}

/**
 * State-based NPC + persistent companion (девочка переживает смену комнаты).
 */
export class CrowdSystem {
  private members = new Map<string, CrowdMember>();
  private layout?: RoomLayout;
  private companion?: Phaser.GameObjects.Image;
  private companionTextureHeight = 1;
  private companionMarker?: Phaser.GameObjects.Ellipse;
  /** Пока companion подходит к игроку — followTarget не перехватывает tween. */
  private companionApproachActive = false;
  private state?: ScenarioState;
  /** Cleanup текущего room build — нужен при отложенной активации companion. */
  private roomCleanup?: Phaser.GameObjects.GameObject[];
  private pendingHelpId?: string;

  constructor(private scene: Phaser.Scene) {}

  build(
    layout: RoomLayout,
    cleanup: Phaser.GameObjects.GameObject[],
    interactions: InteractionSystem,
    state: ScenarioState,
    playerAt: { x: number; y: number },
    onHelpStudent: (npcId?: string, at?: { x: number; y: number }) => void,
  ): void {
    this.members.clear();
    this.layout = layout;
    this.state = state;
    this.roomCleanup = cleanup;
    this.pendingHelpId = undefined;

    for (const def of layout.npcs) {
      // Уже решили вопрос с ученицей — не спавним confused-версию.
      if (
        def.behavior.kind === "confused" &&
        (state.helpedStudent ||
          state.companionActive ||
          state.studentHelpChoice !== null)
      ) {
        continue;
      }

      const image = this.scene.add
        .image(def.at.x, def.at.y, def.textureKey)
        .setOrigin(0.5, 1)
        .setFlipX(def.flipX ?? false)
        .setDepth(def.at.y);
      const textureHeight = image.height;
      image.setScale(this.scaleFor(def, def.at.y, textureHeight));
      cleanup.push(image);

      const member: CrowdMember = {
        def,
        image,
        state: def.behavior.kind === "confused" ? "confused" : "idle",
        textureHeight,
      };
      this.members.set(def.id, member);

      switch (def.behavior.kind) {
        case "idle_sway":
          this.startSway(member);
          break;
        case "walker":
          member.state = "evacuating";
          this.startWalker(member);
          break;
        case "redirect":
          member.state = "evacuating";
          this.startRedirect(member);
          break;
        case "confused": {
          // Не активируем companion сразу — SchoolScene открывает короткий выбор.
          if (state.studentHelpChoice !== null) break;
          this.startSway(member);
          const { helpHotspotId } = def.behavior;
          interactions.register({
            id: helpHotspotId,
            x: def.at.x,
            y: def.at.y,
            radius: 95,
            labelKey: "game.interact.talkStudent",
            onInteract: () => {
              interactions.unregister(helpHotspotId);
              this.pendingHelpId = def.id;
              onHelpStudent(def.id, def.at);
            },
          });
          break;
        }
      }
    }

    if (state.companionActive && !state.companionReachedAssembly) {
      this.ensureCompanionNear(playerAt.x, playerAt.y);
    } else if (state.companionReachedAssembly) {
      this.releaseCompanionToAssembly(layout);
    }
  }

  /** Ведёт companion за игроком; room NPC-followers тоже. */
  update(playerX: number, playerY: number): void {
    if (!this.layout) return;
    if (this.companionApproachActive) return;

    if (this.companion?.active && this.state?.companionActive) {
      this.followTarget(this.companion, playerX, playerY, "teen", 0.96);
    }

    for (const member of this.members.values()) {
      if (member.state !== "following") continue;
      this.followTarget(
        member.image,
        playerX,
        playerY,
        member.def.role,
        member.def.figureFill ?? 1,
        member.textureHeight,
      );
    }
  }

  getDebugSubjects(): CrowdDebugSubject[] {
    const list: CrowdDebugSubject[] = [];
    for (const m of this.members.values()) {
      list.push({
        id: m.def.id,
        x: m.image.x,
        y: m.image.y,
        role: m.def.role,
        textureHeight: m.textureHeight,
        figureFill: m.def.figureFill,
      });
    }
    if (this.companion?.active) {
      list.push({
        id: "companion",
        x: this.companion.x,
        y: this.companion.y,
        role: "teen",
        textureHeight: this.companionTextureHeight,
        figureFill: 0.96,
      });
    }
    return list;
  }

  /**
   * Scripted-эвакуация класса: NPC с waypoint-планом по очереди встают и
   * идут по маршруту «выход из-за парты → проход → дверь». Длительность
   * каждого сегмента пропорциональна его длине — скорость равномерная,
   * без телепортов и прямых через мебель.
   */
  beginEvacuation(): void {
    for (const member of this.members.values()) {
      const plan = member.def.evacuate;
      if (!plan || member.state === "safe") continue;
      member.state = "evacuating";
      this.scene.time.delayedCall(plan.delay, () => {
        if (!member.image.active) return;
        this.scene.tweens.killTweensOf(member.image);
        const img = member.image;
        if (plan.walkTexture) {
          img.setTexture(plan.walkTexture);
          img.setOrigin(0.5, 1);
          member.textureHeight = img.height;
        }

        // Сегменты по waypoint'ам; d ∝ длине сегмента.
        const points = plan.waypoints;
        const lengths: number[] = [];
        let total = 0;
        let prev = { x: img.x, y: img.y };
        for (const p of points) {
          const len = Math.hypot(p.x - prev.x, p.y - prev.y);
          lengths.push(len);
          total += len;
          prev = p;
        }
        const legs = points.map((p, i) => ({
          x: p.x,
          y: p.y,
          d: total > 0 ? Math.max(180, (lengths[i] / total) * plan.duration) : 200,
        }));

        const runLeg = (index: number) => {
          if (index >= legs.length) {
            member.currentTarget = undefined;
            this.scene.tweens.add({
              targets: img,
              alpha: 0,
              duration: 450,
              onComplete: () => {
                member.state = "safe";
                img.setVisible(false);
              },
            });
            return;
          }
          const leg = legs[index];
          member.currentTarget = { x: leg.x, y: leg.y };
          img.setFlipX(leg.x < img.x);
          this.scene.tweens.add({
            targets: img,
            x: leg.x,
            y: leg.y,
            duration: leg.d,
            ease: index === 0 ? "Sine.easeIn" : "Linear",
            onUpdate: () => {
              img.setScale(this.scaleFor(member.def, img.y, member.textureHeight));
              img.setDepth(img.y);
            },
            onComplete: () => runLeg(index + 1),
          });
        };
        runLeg(0);

        this.scene.tweens.add({
          targets: img,
          angle: { from: -0.7, to: 0.7 },
          duration: 360,
          yoyo: true,
          repeat: Math.floor(plan.duration / 720),
        });
      });
    }
  }

  /**
   * Сигнал учителя в холле (smoke stage = medium): redirect-NPC прекращают
   * движение к главному выходу и поворачивают к запасному.
   */
  triggerRedirect(): void {
    for (const member of this.members.values()) {
      const behavior = member.def.behavior;
      if (behavior.kind !== "redirect" || member.redirected) continue;
      member.redirected = true;
      this.runRedirectTurn(member);
    }
  }

  /** Остановить топтание у дыма — пауза перед разворотом. */
  haltRedirectMilling(): void {
    for (const member of this.members.values()) {
      if (member.def.behavior.kind !== "redirect" || member.redirected) continue;
      this.scene.tweens.killTweensOf(member.image);
      member.image.setAngle(0);
    }
  }

  /** Учитель в холле коротко жестикулирует перед перенаправлением группы. */
  playTeacherHallGesture(teacherId = "teacher_hall"): void {
    const teacher = this.members.get(teacherId);
    if (!teacher?.image.active) return;
    this.scene.tweens.killTweensOf(teacher.image);
    const img = teacher.image;
    const baseX = img.x;
    this.scene.tweens.add({
      targets: img,
      x: baseX + 10,
      angle: -4,
      duration: 220,
      yoyo: true,
      repeat: 1,
      ease: "Sine.easeInOut",
      onComplete: () => {
        if (!img.active) return;
        img.setAngle(0);
        this.startSway(teacher);
      },
    });
    this.showBubble(img, this.localeLine("redirect"), 1600);
  }

  /** Короткая реакция NPC на лестнице при проталкивании. */
  reactToCrowdPush(npcId = "landing_group"): void {
    const member = this.members.get(npcId);
    if (!member?.image.active) return;
    const img = member.image;
    this.scene.tweens.add({
      targets: img,
      x: img.x - 8,
      angle: { from: -2, to: 2 },
      duration: 140,
      yoyo: true,
      repeat: 1,
      ease: "Sine.easeOut",
    });
  }

  /** Учитель на точке сбора подтверждает доклад. */
  playAssemblyTeacherAck(teacherId = "assembly_teacher"): void {
    const teacher = this.members.get(teacherId);
    if (!teacher?.image.active) return;
    const img = teacher.image;
    this.scene.tweens.add({
      targets: img,
      scaleX: img.scaleX * 1.04,
      scaleY: img.scaleY * 1.04,
      duration: 280,
      yoyo: true,
      ease: "Sine.easeOut",
    });
    this.showBubble(img, this.localeLine("reportAck"), 2200);
  }

  /** Данные маршрутов для оверлея ?debugNpcPaths=1. */
  getPathDebug(): NpcPathDebug[] {
    const list: NpcPathDebug[] = [];
    for (const m of this.members.values()) {
      if (!m.image.active || !m.image.visible) continue;
      list.push({
        id: m.def.id,
        routeId: m.def.evacuate?.routeId,
        x: m.image.x,
        y: m.image.y,
        waypoints: m.def.evacuate?.waypoints,
        currentTarget: m.currentTarget,
      });
    }
    return list;
  }

  markCompanionReachedAssembly(): void {
    if (!this.state || !this.companion) return;
    this.state.companionReachedAssembly = true;
    this.state.companionActive = false;
    this.companionApproachActive = false;
    this.companionMarker?.destroy();
    this.companionMarker = undefined;
    this.scene.tweens.killTweensOf(this.companion);
    // Остаётся у толпы на точке сбора.
    this.companion.setTexture(NPC_TEX.girlIdle);
    this.companion.setOrigin(0.5, 1);
    this.companionTextureHeight = this.companion.height;
    if (this.layout) {
      this.companion.setPosition(940, 560);
      this.companion.setScale(
        scaleAtDepth(
          this.layout.perspective,
          this.companion.y,
          "teen",
          this.companionTextureHeight,
          0.96,
        ),
      );
      this.companion.setDepth(this.companion.y);
    }
  }

  /** Финальный момент: companion подходит к группе у учителя. */
  joinCompanionToAssemblyGroup(): void {
    if (!this.companion?.active || !this.layout) return;
    this.companionApproachActive = true;
    this.companionMarker?.destroy();
    this.companionMarker = undefined;
    this.scene.tweens.killTweensOf(this.companion);
    const img = this.companion;
    this.scene.tweens.add({
      targets: img,
      x: 940,
      y: 560,
      duration: 1400,
      ease: "Sine.easeInOut",
      onUpdate: () => {
        if (!this.layout || !img.active) return;
        img.setScale(
          scaleAtDepth(
            this.layout.perspective,
            img.y,
            "teen",
            this.companionTextureHeight,
            0.96,
          ),
        );
        img.setDepth(img.y);
      },
      onComplete: () => {
        this.companionApproachActive = false;
        this.markCompanionReachedAssembly();
      },
    });
  }

  destroyCompanion(): void {
    this.companionMarker?.destroy();
    this.companionMarker = undefined;
    this.companionApproachActive = false;
    this.companion?.destroy();
    this.companion = undefined;
  }

  /**
   * «Пойдём вместе»: реплика → подходит к игроку → заметно следует рядом.
   */
  acceptPendingCompanion(playerX: number, playerY: number): boolean {
    if (!this.pendingHelpId || !this.roomCleanup) return false;
    const member = this.members.get(this.pendingHelpId);
    if (!member) return false;
    this.activateCompanionFromMember(member, this.roomCleanup);
    this.pendingHelpId = undefined;
    if (!this.companion) return true;

    this.companionApproachActive = true;
    this.showBubble(this.companion, this.localeLine("together"), 1400);
    const img = this.companion;
    const targetX = playerX - 52;
    const targetY = playerY + 4;
    this.scene.tweens.add({
      targets: img,
      x: targetX,
      y: targetY,
      duration: 700,
      ease: "Sine.easeOut",
      onUpdate: () => {
        if (!this.layout || !img.active) return;
        img.setScale(
          scaleAtDepth(
            this.layout.perspective,
            img.y,
            "teen",
            this.companionTextureHeight,
            0.96,
          ),
        );
        img.setDepth(img.y);
        img.setFlipX(img.x > playerX);
      },
      onComplete: () => {
        this.companionApproachActive = false;
        this.ensureCompanionMarker();
      },
    });
    return true;
  }

  /**
   * «Жди учителя»: ученица подходит к ближайшему взрослому, тот принимает её.
   */
  referPendingToTeacher(teacherId = "teacher_assessing"): boolean {
    if (!this.pendingHelpId) return false;
    const member = this.members.get(this.pendingHelpId);
    this.pendingHelpId = undefined;
    if (!member?.image.active) return false;

    const teacher = this.members.get(teacherId);
    const dest = teacher
      ? { x: teacher.image.x + 48, y: teacher.image.y + 4 }
      : { x: member.def.at.x - 40, y: member.def.at.y + 10 };

    this.scene.tweens.killTweensOf(member.image);
    this.showBubble(member.image, this.localeLine("wait"), 1200);
    member.state = "idle";
    this.scene.tweens.add({
      targets: member.image,
      x: dest.x,
      y: dest.y,
      duration: 1100,
      ease: "Sine.easeInOut",
      onUpdate: () => {
        const img = member.image;
        img.setScale(this.scaleFor(member.def, img.y, member.textureHeight));
        img.setDepth(img.y);
        img.setFlipX(dest.x < img.x);
      },
      onComplete: () => {
        if (!member.image.active) return;
        member.image.setFlipX(false);
        this.startSway(member);
        if (teacher?.image.active) {
          this.scene.tweens.add({
            targets: teacher.image,
            angle: { from: -3, to: 0 },
            duration: 320,
            ease: "Sine.easeOut",
          });
          this.showBubble(teacher.image, this.localeLine("accept"), 1600);
        }
      },
    });
    return true;
  }

  /**
   * «Не могу помочь»: ученица остаётся на месте — сцена не выглядит сломанной.
   */
  dismissPendingHelp(): void {
    const id = this.pendingHelpId;
    this.pendingHelpId = undefined;
    if (!id) return;
    const member = this.members.get(id);
    if (!member?.image.active) return;
    this.scene.tweens.killTweensOf(member.image);
    this.showBubble(member.image, this.localeLine("stay"), 1400);
    member.state = "confused";
    this.startSway(member);
  }

  private activateCompanionFromMember(
    member: CrowdMember,
    cleanup: Phaser.GameObjects.GameObject[],
  ): void {
    if (!this.state) return;
    this.state.helpedStudent = true;
    this.state.companionActive = true;
    this.scene.tweens.killTweensOf(member.image);

    // Убрать из room cleanup — иначе уничтожится при loadRoom.
    const idx = cleanup.indexOf(member.image);
    if (idx >= 0) cleanup.splice(idx, 1);

    this.companion = member.image;
    this.companionTextureHeight = member.image.height;
    if (member.def.behavior.kind === "confused") {
      this.companion.setTexture(member.def.behavior.followTexture);
      this.companion.setOrigin(0.5, 1);
      this.companionTextureHeight = this.companion.height;
    }
    this.members.delete(member.def.id);
  }

  /** Лёгкий маркер «рядом с вами» под ногами companion. */
  private ensureCompanionMarker(): void {
    if (!this.companion?.active || this.companionMarker?.active) return;
    this.companionMarker = this.scene.add
      .ellipse(this.companion.x, this.companion.y + 4, 36, 12, 0x2fae5f, 0.28)
      .setDepth(this.companion.y - 1);
    this.scene.tweens.add({
      targets: this.companionMarker,
      alpha: { from: 0.18, to: 0.4 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private ensureCompanionNear(playerX: number, playerY: number): void {
    if (!this.companion || !this.companion.scene) {
      this.companion = this.scene.add
        .image(playerX - 56, playerY + 4, NPC_TEX.girlWalk)
        .setOrigin(0.5, 1)
        .setDepth(playerY);
      this.companionTextureHeight = this.companion.height;
    } else {
      this.companion.setPosition(playerX - 56, playerY + 4);
      this.companion.setTexture(NPC_TEX.girlWalk);
      this.companion.setOrigin(0.5, 1);
      this.companionTextureHeight = this.companion.height;
      this.companion.setVisible(true).setAlpha(1);
    }
    if (this.layout) {
      this.companion.setScale(
        scaleAtDepth(
          this.layout.perspective,
          this.companion.y,
          "teen",
          this.companionTextureHeight,
          0.96,
        ),
      );
      this.companion.setDepth(this.companion.y);
    }
    this.ensureCompanionMarker();
  }

  private releaseCompanionToAssembly(layout: RoomLayout): void {
    if (!this.companion?.active) return;
    this.companion.setPosition(940, 560);
    this.companion.setTexture(NPC_TEX.girlIdle);
    this.companionTextureHeight = this.companion.height;
    this.companion.setScale(
      scaleAtDepth(
        layout.perspective,
        this.companion.y,
        "teen",
        this.companionTextureHeight,
        0.96,
      ),
    );
    this.companion.setDepth(this.companion.y);
  }

  private followTarget(
    img: Phaser.GameObjects.Image,
    playerX: number,
    playerY: number,
    role: FigureRole,
    figureFill: number,
    textureHeight?: number,
  ): void {
    if (!this.layout) return;
    // Ближе и отзывчивее — companion читается как «идёт рядом», не «телепорт».
    const targetX = playerX - 48;
    const targetY = playerY + 6;
    img.x += (targetX - img.x) * 0.12;
    img.y += (targetY - img.y) * 0.12;
    img.setFlipX(img.x > playerX);
    const th = textureHeight ?? this.companionTextureHeight;
    img.setScale(
      scaleAtDepth(this.layout.perspective, img.y, role, th, figureFill),
    );
    img.setDepth(img.y);
    if (this.companionMarker?.active && img === this.companion) {
      this.companionMarker.setPosition(img.x, img.y + 4);
      this.companionMarker.setDepth(img.y - 1);
    }
  }

  private localeLine(
    kind: "together" | "wait" | "accept" | "stay" | "redirect" | "reportAck",
  ): string {
    const ru = typeof document !== "undefined" &&
      document.documentElement.lang?.startsWith("ru");
    const lines = ru
      ? {
          together: "Иду с вами",
          wait: "Жду учителя",
          accept: "Хорошо, оставайся",
          stay: "Я подожду здесь",
          redirect: "К запасному выходу!",
          reportAck: "Принято. Все на месте.",
        }
      : {
          together: "Сізбен барамын",
          wait: "Мұғалімді күтемін",
          accept: "Жақсы, күт",
          stay: "Осында тұрамын",
          redirect: "Қосалқы шығуға!",
          reportAck: "Қабылданды. Бәрі жиналды.",
        };
    return lines[kind];
  }

  private showBubble(
    anchor: Phaser.GameObjects.Image,
    text: string,
    durationMs: number,
  ): void {
    if (!anchor.active) return;
    const bubble = this.scene.add
      .text(anchor.x, anchor.y - anchor.displayHeight * 0.92, text, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "13px",
        color: "#f4f7fb",
        backgroundColor: "#0b1526cc",
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5, 1)
      .setDepth(anchor.y + 40)
      .setAlpha(0);
    const riseTo = bubble.y - 6;
    this.scene.tweens.add({
      targets: bubble,
      alpha: 1,
      y: riseTo,
      duration: 180,
      onComplete: () => {
        this.scene.time.delayedCall(Math.max(400, durationMs - 360), () => {
          if (!bubble.active) return;
          this.scene.tweens.add({
            targets: bubble,
            alpha: 0,
            duration: 160,
            onComplete: () => bubble.destroy(),
          });
        });
      },
    });
  }

  private scaleFor(def: RoomNpc, y: number, textureHeight: number): number {
    if (!this.layout) return 1;
    return scaleAtDepth(
      this.layout.perspective,
      y,
      def.role,
      textureHeight,
      def.figureFill ?? 1,
    );
  }

  private startSway(member: CrowdMember): void {
    const base = this.scaleFor(
      member.def,
      member.def.at.y,
      member.textureHeight,
    );
    this.scene.tweens.add({
      targets: member.image,
      y: member.def.at.y - 2,
      scaleX: base * 1.01,
      scaleY: base * 1.01,
      duration: 2400 + Math.random() * 800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  /**
   * «Толпа идёт к привычному выходу → упирается в дым → поворачивает к
   * запасному»: учит, что поведение толпы — не ориентир безопасности.
   *
   * Этап 1 (до сигнала): группа идёт к главному выходу и топчется перед
   * ним. Этап 2 запускается ТОЛЬКО из triggerRedirect() — по smoke stage
   * medium, синхронно с сигналом учителя. NPC не заходит в плотный дым.
   */
  private startRedirect(member: CrowdMember): void {
    const { def } = member;
    if (def.behavior.kind !== "redirect") return;
    const { toward, towardDuration } = def.behavior;
    const img = member.image;

    img.setPosition(def.at.x, def.at.y);
    img.setScale(this.scaleFor(def, def.at.y, member.textureHeight));
    img.setAlpha(0);
    img.setFlipX(false);
    this.scene.tweens.add({ targets: img, alpha: 1, duration: 500 });

    member.currentTarget = { x: toward.x, y: toward.y };
    this.scene.tweens.add({
      targets: img,
      x: toward.x,
      y: toward.y,
      duration: towardDuration,
      ease: "Sine.easeOut",
      onUpdate: () => {
        img.setScale(this.scaleFor(def, img.y, member.textureHeight));
        img.setDepth(img.y);
      },
      onComplete: () => {
        if (member.redirected) return;
        // Топтание перед дымом — ждём сигнала учителя (triggerRedirect).
        this.scene.tweens.add({
          targets: img,
          x: img.x + 6,
          duration: 260,
          yoyo: true,
          repeat: -1,
        });
      },
    });
  }

  /** Этап 2 redirect'а: пауза-заминка и разворот к запасному выходу. */
  private runRedirectTurn(member: CrowdMember): void {
    const { def } = member;
    if (def.behavior.kind !== "redirect") return;
    const { pauseMs, then, thenDuration } = def.behavior;
    const img = member.image;
    if (!img.active) return;

    this.scene.tweens.killTweensOf(img);
    this.scene.time.delayedCall(pauseMs, () => {
      if (!img.active) return;
      img.setFlipX(then.x < img.x);
      member.currentTarget = { x: then.x, y: then.y };
      this.scene.tweens.add({
        targets: img,
        x: then.x,
        y: then.y,
        duration: thenDuration,
        ease: "Sine.easeInOut",
        onUpdate: () => {
          img.setScale(this.scaleFor(def, img.y, member.textureHeight));
          img.setDepth(img.y);
        },
        onComplete: () => {
          member.currentTarget = undefined;
          this.scene.tweens.add({
            targets: img,
            alpha: 0,
            duration: 600,
            onComplete: () => {
              member.state = "safe";
              img.setVisible(false);
            },
          });
        },
      });
    });
  }

  private startWalker(member: CrowdMember): void {
    const { def } = member;
    if (def.behavior.kind !== "walker") return;
    const { to, duration, repeatDelay, fadeAtEnd } = def.behavior;
    const img = member.image;

    const run = () => {
      const startScale = this.scaleFor(def, def.at.y, member.textureHeight);
      img.setPosition(def.at.x, def.at.y);
      img.setScale(startScale);
      img.setAlpha(0);
      this.scene.tweens.add({ targets: img, alpha: 1, duration: 500 });
      this.scene.tweens.add({
        targets: img,
        x: to.x,
        y: to.y,
        duration,
        ease: "Sine.easeInOut",
        onUpdate: () => {
          img.setScale(this.scaleFor(def, img.y, member.textureHeight));
          img.setDepth(img.y);
          img.setFlipX(to.x < def.at.x);
        },
        onComplete: () => {
          if (fadeAtEnd) {
            this.scene.tweens.add({
              targets: img,
              alpha: 0,
              duration: 600,
              onComplete: () => {
                if (repeatDelay !== undefined) {
                  this.scene.time.delayedCall(repeatDelay, run);
                } else {
                  member.state = "safe";
                }
              },
            });
          } else {
            member.state = "safe";
          }
        },
      });
      this.scene.tweens.add({
        targets: img,
        angle: { from: -0.6, to: 0.6 },
        duration: 380,
        yoyo: true,
        repeat: Math.floor(duration / 760),
      });
    };
    run();
  }
}
