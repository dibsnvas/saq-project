import { eventBus } from "../EventBus";
import type { RoomLayout } from "../rooms/types";
import { walkT, xBoundsAt } from "../rooms/walk";

const EMIT_INTERVAL_MS = 120;

/**
 * Phaser-сторона мини-карты: с умеренной частотой транслирует в React
 * нормализованную позицию игрока внутри текущей комнаты (0..1 по ширине
 * пола и по глубине). Как рисовать карту — решает React (Minimap.tsx).
 */
export class MinimapSystem {
  private accumulator = 0;

  roomChanged(roomId: string): void {
    eventBus.emit("room:changed", { room: roomId });
  }

  update(
    layout: RoomLayout,
    playerX: number,
    playerY: number,
    deltaMs: number,
  ): void {
    this.accumulator += deltaMs;
    if (this.accumulator < EMIT_INTERVAL_MS) return;
    this.accumulator = 0;

    const { min, max } = xBoundsAt(layout.walk, playerY);
    const nx = (playerX - min) / Math.max(1, max - min);
    const ny = walkT(layout.walk, playerY);

    eventBus.emit("minimap:update", {
      room: layout.id,
      x: Math.min(1, Math.max(0, nx)),
      y: Math.min(1, Math.max(0, ny)),
    });
  }
}
