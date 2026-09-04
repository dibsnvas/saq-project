import Phaser from "phaser";
import { figureHeightAt, spriteScale } from "../rooms/perspective";
import type { FigureRole, RoomLayout } from "../rooms/types";

interface DebugSubject {
  id: string;
  x: number;
  y: number;
  role: FigureRole;
  textureHeight: number;
  figureFill: number;
  displayHeight: number;
  scale: number;
}

/**
 * Dev-only оверлей (`?debugPerspective=1`): foot anchor, display height,
 * scale, роль, room id. В production не монтируется.
 */
export class PerspectiveDebugSystem {
  private layer?: Phaser.GameObjects.Container;
  private graphics?: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private enabled = false;

  constructor(private scene: Phaser.Scene) {}

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.clear();
      return;
    }
    if (!this.layer) {
      this.graphics = this.scene.add.graphics().setDepth(9000);
      this.layer = this.scene.add.container(0, 0, [this.graphics]).setDepth(9000);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  update(
    layout: RoomLayout,
    subjects: Array<{
      id: string;
      x: number;
      y: number;
      role: FigureRole;
      textureHeight: number;
      figureFill?: number;
    }>,
  ): void {
    if (!this.enabled || !this.graphics) return;
    this.graphics.clear();
    for (const label of this.labels) label.destroy();
    this.labels = [];

    const roomLabel = this.scene.add
      .text(12, 56, `room: ${layout.id}`, {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#7dffb3",
        backgroundColor: "#0a1526cc",
        padding: { x: 6, y: 3 },
      })
      .setScrollFactor(0)
      .setDepth(9001);
    this.labels.push(roomLabel);

    for (const s of subjects) {
      const fill = s.figureFill ?? 1;
      const displayHeight = figureHeightAt(layout.perspective, s.y, s.role) / Math.min(1, Math.max(0.35, fill));
      const scale = spriteScale(
        layout.perspective,
        s.y,
        s.role,
        s.textureHeight,
        fill,
      );
      this.drawSubject({
        ...s,
        figureFill: fill,
        displayHeight,
        scale,
      });
    }
  }

  private drawSubject(s: DebugSubject): void {
    if (!this.graphics) return;
    const topY = s.y - s.displayHeight;
    this.graphics.lineStyle(2, 0x7dffb3, 0.9);
    this.graphics.strokeCircle(s.x, s.y, 5);
    this.graphics.lineBetween(s.x, s.y, s.x, topY);
    this.graphics.strokeRect(s.x - 18, topY, 36, s.displayHeight);

    const text = this.scene.add
      .text(
        s.x + 10,
        topY,
        `${s.id}\n${s.role} h=${Math.round(s.displayHeight)} sc=${s.scale.toFixed(2)}`,
        {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#e8fff2",
          backgroundColor: "#0a1526aa",
          padding: { x: 4, y: 2 },
        },
      )
      .setDepth(9001);
    this.labels.push(text);
  }

  clear(): void {
    this.graphics?.clear();
    for (const label of this.labels) label.destroy();
    this.labels = [];
    this.layer?.destroy(true);
    this.layer = undefined;
    this.graphics = undefined;
  }
}
