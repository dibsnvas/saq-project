import Phaser from "phaser";
import type { RoomLayout } from "../rooms/types";
import { xBoundsAt } from "../rooms/walk";
import type { Interactable } from "./InteractionSystem";

/**
 * Dev-only оверлей коллизий (`?debugCollisions=1`):
 * зелёным — walkable-трапеция, красным — препятствия (парты/столы),
 * жёлтым — slow-зоны, голубым — радиусы взаимодействий, белым — игрок.
 * В production выключен (флаг из query-параметра).
 */
export class CollisionDebugSystem {
  private graphics?: Phaser.GameObjects.Graphics;
  private enabled = false;

  constructor(private scene: Phaser.Scene) {}

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.clear();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  clear(): void {
    this.graphics?.destroy();
    this.graphics = undefined;
  }

  update(
    layout: RoomLayout,
    playerX: number,
    playerY: number,
    interactables: ReadonlyArray<Interactable>,
  ): void {
    if (!this.enabled) return;
    if (!this.graphics || !this.graphics.active) {
      this.graphics = this.scene.add.graphics().setDepth(9000);
    }
    const g = this.graphics;
    g.clear();

    // Walkable-трапеция
    g.lineStyle(2, 0x2fae5f, 0.9);
    g.beginPath();
    const { walk } = layout;
    const top = xBoundsAt(walk, walk.yTop);
    const bottom = xBoundsAt(walk, walk.yBottom);
    g.moveTo(top.min, walk.yTop);
    g.lineTo(top.max, walk.yTop);
    g.lineTo(bottom.max, walk.yBottom);
    g.lineTo(bottom.min, walk.yBottom);
    g.closePath();
    g.strokePath();
    g.fillStyle(0x2fae5f, 0.07);
    g.fillPath();

    // Препятствия
    for (const rect of layout.obstacles ?? []) {
      g.fillStyle(0xd83a3a, 0.28);
      g.fillRect(rect.x, rect.y, rect.width, rect.height);
      g.lineStyle(1, 0xd83a3a, 0.9);
      g.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }

    // Slow-зоны
    for (const zone of layout.slowZones ?? []) {
      g.fillStyle(0xe8b93c, 0.2);
      g.fillRect(zone.rect.x, zone.rect.y, zone.rect.width, zone.rect.height);
      g.lineStyle(1, 0xe8b93c, 0.9);
      g.strokeRect(zone.rect.x, zone.rect.y, zone.rect.width, zone.rect.height);
    }

    // Радиусы взаимодействий
    g.lineStyle(1, 0x6ec4ff, 0.8);
    for (const item of interactables) {
      g.strokeCircle(item.x, item.y, item.radius);
    }

    // Точка игрока (ноги)
    g.fillStyle(0xffffff, 1);
    g.fillCircle(playerX, playerY, 4);
    g.lineStyle(1, 0xffffff, 0.6);
    g.strokeCircle(playerX, playerY, 10);
  }
}
