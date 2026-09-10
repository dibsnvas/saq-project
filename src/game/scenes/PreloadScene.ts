import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, PALETTE, REGISTRY_PACK_KEY } from "../constants";
import type { ScenarioPack } from "../scenarios/types";
import {
  buildManifest,
  FX_ANIM,
  FX_TEX,
  PLAYER_ANIM,
  PLAYER_TEX,
  type Direction,
} from "../assets";

export const GEN_TEX = {
  dust: "gen-dust",
  vignette: "gen-vignette",
} as const;

/**
 * Загружает ассет-пак (фоны, игрок, NPC, объекты, эффекты), рисует
 * прогресс-бар, генерирует служебные текстуры и глобальные анимации.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  preload(): void {
    this.drawProgressBar();
    this.load.setPath("/");
    const pack = this.registry.get(REGISTRY_PACK_KEY) as ScenarioPack;
    for (const entry of buildManifest(pack.assets)) {
      this.load.image(entry.key, entry.url);
    }
  }

  create(): void {
    this.createGeneratedTextures();
    this.createPlayerAnimations();
    this.createSmokeAnimations();
    this.scene.start("SchoolScene");
  }

  private drawProgressBar(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const width = 320;

    this.add.rectangle(cx, cy, width, 6, 0xffffff, 0.12);
    const bar = this.add
      .rectangle(cx - width / 2, cy, 0, 6, PALETTE.safe)
      .setOrigin(0, 0.5);

    this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => {
      bar.width = width * value;
    });
  }

  /** Пылинка и виньетка — рисуются кодом, ассеты для них не нужны. */
  private createGeneratedTextures(): void {
    if (!this.textures.exists(GEN_TEX.dust)) {
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 0.55);
      g.fillCircle(3, 3, 2);
      g.generateTexture(GEN_TEX.dust, 6, 6);
      g.destroy();
    }

    if (!this.textures.exists(GEN_TEX.vignette)) {
      // Мягкое затемнение к краям кадра: концентрические рамки.
      const g = this.add.graphics();
      const w = 320;
      const h = 180;
      for (let i = 0; i < 26; i++) {
        g.lineStyle(3, 0x000000, (i / 26) ** 2 * 0.5);
        g.strokeRect(i * 2.4, i * 1.6, w - i * 4.8, h - i * 3.2);
      }
      g.generateTexture(GEN_TEX.vignette, w, h);
      g.destroy();
    }
  }

  private createPlayerAnimations(): void {
    const dirs: Direction[] = ["up", "down", "left", "right"];
    for (const dir of dirs) {
      const animKey = PLAYER_ANIM[dir];
      if (this.anims.exists(animKey)) continue;
      // Только 1–2: кадры 3–4 убраны из-за белого фона.
      this.anims.create({
        key: animKey,
        frames: [1, 2].map((i) => ({
          key: `${PLAYER_TEX.walkPrefix[dir]}${i}`,
        })),
        frameRate: 6,
        repeat: -1,
      });
    }
  }

  private createSmokeAnimations(): void {
    const sets: Array<{ anim: string; prefix: string }> = [
      { anim: FX_ANIM.smokeLight, prefix: FX_TEX.smokeLightPrefix },
      { anim: FX_ANIM.smokeMedium, prefix: FX_TEX.smokeMediumPrefix },
      { anim: FX_ANIM.smokeHeavy, prefix: FX_TEX.smokeHeavyPrefix },
    ];
    for (const { anim, prefix } of sets) {
      if (this.anims.exists(anim)) continue;
      this.anims.create({
        key: anim,
        frames: [1, 2, 3, 4, 5, 6].map((i) => ({ key: `${prefix}${i}` })),
        frameRate: 5,
        repeat: -1,
        yoyo: true,
      });
    }
  }
}
