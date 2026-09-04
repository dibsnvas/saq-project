import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, PALETTE } from "../constants";

/**
 * Тонкая сцена дебрифа: затемняет мир и рисует маркер успеха.
 * Локализованный текст, время и кнопки показывает React-оверлей (GameHud) —
 * канвас не рендерит переводимые строки.
 */
export class DebriefScene extends Phaser.Scene {
  constructor() {
    super("DebriefScene");
  }

  create(data: { success?: boolean }): void {
    const success = data?.success !== false;
    const dim = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05070d)
      .setOrigin(0)
      .setAlpha(0);
    this.tweens.add({ targets: dim, alpha: 0.55, duration: 350 });

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2 - 170;
    const color = success ? PALETTE.safe : PALETTE.danger;
    const circle = this.add.circle(cx, cy, 36, color).setScale(0);
    const mark = this.add.graphics();
    mark.lineStyle(6, 0xffffff);
    mark.beginPath();
    if (success) {
      mark.moveTo(cx - 14, cy + 1);
      mark.lineTo(cx - 4, cy + 11);
      mark.lineTo(cx + 15, cy - 10);
    } else {
      mark.moveTo(cx - 12, cy - 12);
      mark.lineTo(cx + 12, cy + 12);
      mark.moveTo(cx + 12, cy - 12);
      mark.lineTo(cx - 12, cy + 12);
    }
    mark.strokePath();
    mark.setAlpha(0);

    this.tweens.add({
      targets: circle,
      scale: 1,
      duration: 320,
      ease: "Back.easeOut",
    });
    this.tweens.add({ targets: mark, alpha: 1, duration: 200, delay: 240 });
  }
}
