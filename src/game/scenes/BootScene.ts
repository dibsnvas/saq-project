import Phaser from "phaser";

/**
 * Первая сцена цепочки. Здесь остаются глобальные настройки рендера;
 * генерация текстур вынесена в PreloadScene.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create(): void {
    this.cameras.main.setRoundPixels(true);
    this.scene.start("PreloadScene");
  }
}
