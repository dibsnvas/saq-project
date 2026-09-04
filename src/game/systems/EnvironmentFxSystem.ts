import Phaser from "phaser";
import { FX_TEX } from "../assets";
import { BASE_ZOOM, GAME_HEIGHT, GAME_WIDTH } from "../constants";
import { GEN_TEX } from "../scenes/PreloadScene";
import type {
  RoomLayout,
  SmokeFxDef,
  SmokeStage,
} from "../rooms/types";

/** Порядок стадий задымления (нарастание слоями). */
const SMOKE_STAGE_ORDER: SmokeStage[] = [
  "none",
  "distant",
  "light",
  "medium",
  "blocked",
];

export function smokeStageIndex(stage: SmokeStage): number {
  return SMOKE_STAGE_ORDER.indexOf(stage);
}

/**
 * Атмосферные эффекты: дым (кадровые анимации из пака), дымка, тревожная
 * красная пульсация, пылинки, виньетка, «дыхание» камеры. Объекты комнаты
 * регистрируются во внешний список очистки и умирают вместе с комнатой.
 */
export class EnvironmentFxSystem {
  private alarmActive = false;
  private alarmGlow?: Phaser.GameObjects.Image;
  private alarmOverlay?: Phaser.GameObjects.Image;
  private alarmTweens: Phaser.Tweens.Tween[] = [];
  /** стадии, слои которых уже построены в текущей комнате */
  private builtStages = new Set<SmokeStage>();
  private stageCleanup?: Phaser.GameObjects.GameObject[];
  private stageLayout?: RoomLayout;
  /** Лёгкое ухудшение видимости у дыма (0..1), без HP/game over. */
  private smokeProximity = 0;
  private smokeVeil?: Phaser.GameObjects.Rectangle;

  constructor(private scene: Phaser.Scene) {}

  /** Едва заметное дыхание камеры — сцена ощущается живой. */
  startCameraBreathing(): void {
    this.scene.tweens.add({
      targets: this.scene.cameras.main,
      zoom: { from: BASE_ZOOM, to: BASE_ZOOM + 0.011 },
      duration: 4600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  /** Постоянная виньетка поверх всех комнат. */
  createVignette(): void {
    this.scene.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, GEN_TEX.vignette)
      .setDisplaySize(GAME_WIDTH * 1.15, GAME_HEIGHT * 1.15)
      .setScrollFactor(0)
      .setAlpha(0.5)
      .setDepth(5000);
  }

  /** Строит эффекты комнаты; созданные объекты кладёт в cleanup. */
  buildRoomFx(
    layout: RoomLayout,
    cleanup: Phaser.GameObjects.GameObject[],
  ): void {
    this.alarmGlow = undefined;
    this.alarmOverlay = undefined;
    this.alarmTweens = [];
    this.smokeProximity = 0;
    this.smokeVeil = undefined;
    this.builtStages.clear();
    this.stageCleanup = cleanup;
    this.stageLayout = layout;

    for (const smoke of layout.fx.smoke ?? []) {
      this.addSmokeSprite(smoke, cleanup, false);
    }

    if (layout.fx.haze) {
      this.addHaze(layout.fx.haze, cleanup, false);
    }

    if (layout.fx.dust) {
      const emitter = this.scene.add.particles(0, 0, GEN_TEX.dust, {
        x: { min: 100, max: GAME_WIDTH - 100 },
        y: { min: 160, max: GAME_HEIGHT - 80 },
        lifespan: 6000,
        speedX: { min: -6, max: 6 },
        speedY: { min: -4, max: 2 },
        alpha: { start: 0.2, end: 0 },
        scale: { min: 0.4, max: 1 },
        frequency: 320,
        quantity: 1,
      });
      emitter.setDepth(2050);
      cleanup.push(emitter);
    }

    if (layout.fx.alarm) {
      // Красный отсвет тревоги под потолком + лёгкая пульсация кадра.
      this.alarmGlow = this.scene.add
        .image(GAME_WIDTH / 2, 60, FX_TEX.alertGlowWide)
        .setDisplaySize(GAME_WIDTH * 1.1, 190)
        .setAlpha(0)
        .setDepth(2300);
      this.alarmOverlay = this.scene.add
        .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, FX_TEX.alertOverlayRed)
        .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
        .setScrollFactor(0)
        .setAlpha(0)
        .setDepth(4900);
      cleanup.push(this.alarmGlow, this.alarmOverlay);

      if (this.alarmActive) this.startAlarmTweens();
    }
  }

  /**
   * Поднимает staged-дым до заданной стадии: слои недостающих стадий
   * добавляются с плавным проявлением, уже построенные не трогаются —
   * дым нарастает, а не «включается стеной».
   */
  setSmokeStage(stage: SmokeStage): void {
    const layout = this.stageLayout;
    const cleanup = this.stageCleanup;
    if (!layout?.fx.smokeStages || !cleanup) return;

    const targetIdx = smokeStageIndex(stage);
    for (const s of SMOKE_STAGE_ORDER) {
      if (s === "none" || smokeStageIndex(s) > targetIdx) continue;
      if (this.builtStages.has(s)) continue;
      this.builtStages.add(s);
      const fx = layout.fx.smokeStages[s];
      if (!fx) continue;
      for (const smoke of fx.smoke ?? []) {
        this.addSmokeSprite(smoke, cleanup, true);
      }
      if (fx.haze) this.addHaze(fx.haze, cleanup, true);
    }
  }

  /** Кадровый дым; fadeIn — плавное проявление при росте стадии. */
  private addSmokeSprite(
    smoke: SmokeFxDef,
    cleanup: Phaser.GameObjects.GameObject[],
    fadeIn: boolean,
  ): void {
    const sprite = this.scene.add
      .sprite(smoke.at.x, smoke.at.y, "__DEFAULT")
      .setScale(smoke.scale)
      .setAlpha(fadeIn ? 0 : smoke.alpha)
      // Дым «заякорен» к полу в глубине: игрок ближе к камере рисуется
      // поверх, а при входе в глубину — скрывается в дыму.
      .setDepth(smoke.at.y + 130);
    sprite.play(smoke.anim);
    cleanup.push(sprite);

    if (fadeIn) {
      this.scene.tweens.add({
        targets: sprite,
        alpha: smoke.alpha,
        duration: 1600,
        ease: "Sine.easeIn",
      });
    }
    this.scene.tweens.add({
      targets: sprite,
      x: smoke.at.x + smoke.drift,
      scale: smoke.scale * 1.08,
      duration: 3400 + Math.random() * 1600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private addHaze(
    def: { rect: { x: number; y: number; width: number; height: number }; textureKey: string; alpha: number },
    cleanup: Phaser.GameObjects.GameObject[],
    fadeIn: boolean,
  ): void {
    const { rect, textureKey, alpha } = def;
    const haze = this.scene.add
      .image(rect.x + rect.width / 2, rect.y + rect.height / 2, textureKey)
      .setDisplaySize(rect.width, rect.height)
      .setAlpha(fadeIn ? 0 : alpha)
      .setDepth(rect.y + rect.height + 40);
    cleanup.push(haze);
    if (fadeIn) {
      this.scene.tweens.add({
        targets: haze,
        alpha,
        duration: 1800,
        ease: "Sine.easeIn",
        onComplete: () => this.startHazeDrift(haze, rect, alpha),
      });
    } else {
      this.startHazeDrift(haze, rect, alpha);
    }
  }

  private startHazeDrift(
    haze: Phaser.GameObjects.Image,
    rect: { x: number; width: number },
    alpha: number,
  ): void {
    if (!haze.active) return;
    this.scene.tweens.add({
      targets: haze,
      alpha: alpha * 0.72,
      x: rect.x + rect.width / 2 + 14,
      duration: 4200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  /** Включается после обнаружения дыма; действует во всех комнатах с fx.alarm. */
  setAlarmActive(active: boolean): void {
    if (this.alarmActive === active) return;
    this.alarmActive = active;
    if (active) this.startAlarmTweens();
  }

  /**
   * Близость к дыму: слегка снижает видимость (серая пелена).
   * level 0 — чисто; 1 — максимум лёгкого эффекта (не блокирует игру).
   */
  setSmokeProximity(level: number): void {
    const next = Phaser.Math.Clamp(level, 0, 1);
    if (next <= 0.01) {
      this.smokeProximity = 0;
      if (this.smokeVeil?.active) {
        const veil = this.smokeVeil;
        this.scene.tweens.add({
          targets: veil,
          alpha: 0,
          duration: 260,
          onComplete: () => {
            if (this.smokeVeil === veil) {
              veil.destroy();
              this.smokeVeil = undefined;
            }
          },
        });
      }
      return;
    }
    if (Math.abs(next - this.smokeProximity) < 0.02 && this.smokeVeil) {
      this.smokeProximity = next;
      this.smokeVeil.setAlpha(next * 0.22);
      return;
    }
    this.smokeProximity = next;
    if (!this.smokeVeil) {
      this.smokeVeil = this.scene.add
        .rectangle(
          GAME_WIDTH / 2,
          GAME_HEIGHT / 2,
          GAME_WIDTH,
          GAME_HEIGHT,
          0x6a6f78,
          0.22,
        )
        .setScrollFactor(0)
        .setDepth(4850)
        .setAlpha(0);
      this.stageCleanup?.push(this.smokeVeil);
    }
    this.scene.tweens.add({
      targets: this.smokeVeil,
      alpha: next * 0.22,
      duration: 180,
    });
  }

  private startAlarmTweens(): void {
    if (this.alarmGlow) {
      this.alarmTweens.push(
        this.scene.tweens.add({
          targets: this.alarmGlow,
          alpha: { from: 0.12, to: 0.5 },
          duration: 900,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        }),
      );
    }
    if (this.alarmOverlay) {
      this.alarmTweens.push(
        this.scene.tweens.add({
          targets: this.alarmOverlay,
          alpha: { from: 0.02, to: 0.09 },
          duration: 900,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        }),
      );
    }
  }
}
