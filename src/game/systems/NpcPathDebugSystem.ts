import Phaser from "phaser";
import type { NpcPathDebug } from "./CrowdSystem";

/**
 * Dev-only оверлей `?debugNpcPaths=1`: waypoint-точки, линии маршрутов,
 * текущая цель каждого NPC и id маршрута. В production выключен
 * (флаг ставится только из query-параметра в config.ts).
 */
export class NpcPathDebugSystem {
  private enabled = false;
  private graphics?: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];

  constructor(private scene: Phaser.Scene) {}

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.clear();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  update(paths: NpcPathDebug[]): void {
    if (!this.enabled) return;
    if (!this.graphics || !this.graphics.active) {
      this.graphics = this.scene.add.graphics().setDepth(6000);
    }
    const g = this.graphics;
    g.clear();
    for (const label of this.labels) label.destroy();
    this.labels = [];

    for (const path of paths) {
      // Маршрут: линии между waypoint'ами + точки.
      if (path.waypoints && path.waypoints.length > 0) {
        g.lineStyle(1.5, 0x39c1e8, 0.75);
        g.beginPath();
        g.moveTo(path.waypoints[0].x, path.waypoints[0].y);
        for (const p of path.waypoints.slice(1)) g.lineTo(p.x, p.y);
        g.strokePath();
        for (const p of path.waypoints) {
          g.fillStyle(0x39c1e8, 0.9);
          g.fillCircle(p.x, p.y, 4);
        }
        if (path.routeId) {
          this.addLabel(
            path.waypoints[0].x + 8,
            path.waypoints[0].y - 16,
            path.routeId,
            "#39c1e8",
          );
        }
      }

      // Текущая цель NPC: линия от спрайта + крест.
      if (path.currentTarget) {
        g.lineStyle(1.2, 0xffc53d, 0.9);
        g.lineBetween(path.x, path.y, path.currentTarget.x, path.currentTarget.y);
        g.lineBetween(
          path.currentTarget.x - 6,
          path.currentTarget.y - 6,
          path.currentTarget.x + 6,
          path.currentTarget.y + 6,
        );
        g.lineBetween(
          path.currentTarget.x - 6,
          path.currentTarget.y + 6,
          path.currentTarget.x + 6,
          path.currentTarget.y - 6,
        );
      }

      this.addLabel(path.x, path.y - 8, path.id, "#ffffff");
    }
  }

  clear(): void {
    this.graphics?.destroy();
    this.graphics = undefined;
    for (const label of this.labels) label.destroy();
    this.labels = [];
  }

  private addLabel(x: number, y: number, text: string, color: string): void {
    this.labels.push(
      this.scene.add
        .text(x, y, text, {
          fontSize: "10px",
          color,
          backgroundColor: "rgba(6,11,20,0.65)",
          padding: { x: 3, y: 1 },
        })
        .setOrigin(0.5, 1)
        .setDepth(6001),
    );
  }
}
