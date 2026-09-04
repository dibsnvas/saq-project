import Phaser from "phaser";
import { eventBus } from "../EventBus";

export interface Interactable {
  id: string;
  x: number;
  y: number;
  radius: number;
  /** ключ локализации подсказки («Открыть дверь», «Выйти»…) — переводит HUD */
  labelKey: string;
  onInteract: () => void;
}

/**
 * Держит реестр интерактивных объектов, следит за ближайшим доступным
 * и сообщает HUD, когда контекстное действие появляется или исчезает.
 */
export class InteractionSystem {
  private items = new Map<string, Interactable>();
  private activeId: string | null = null;

  constructor(scene: Phaser.Scene) {
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.items.clear();
      this.clearActive();
    });
  }

  register(item: Interactable): void {
    this.items.set(item.id, item);
  }

  unregister(id: string): void {
    this.items.delete(id);
    if (this.activeId === id) {
      this.clearActive();
    }
  }

  /** Снимает все интерактивы (используется при смене комнаты). */
  clearAll(): void {
    this.items.clear();
    this.clearActive();
  }

  /** Текущий список интерактивов (для debug-оверлея). */
  getAll(): ReadonlyArray<Interactable> {
    return [...this.items.values()];
  }

  /** Вызывается каждый кадр с позицией игрока. */
  update(playerX: number, playerY: number): void {
    let nearest: Interactable | null = null;
    let nearestDistSq = Number.POSITIVE_INFINITY;

    for (const item of this.items.values()) {
      const distSq = Phaser.Math.Distance.Squared(
        playerX,
        playerY,
        item.x,
        item.y,
      );
      if (distSq <= item.radius * item.radius && distSq < nearestDistSq) {
        nearest = item;
        nearestDistSq = distSq;
      }
    }

    const nextId = nearest?.id ?? null;
    if (nextId === this.activeId) return;

    this.activeId = nextId;
    if (nearest) {
      eventBus.emit("interaction:available", {
        id: nearest.id,
        labelKey: nearest.labelKey,
      });
    } else {
      eventBus.emit("interaction:cleared");
    }
  }

  /** Выполняет действие ближайшего доступного объекта, если он есть. */
  tryInteract(): void {
    if (!this.activeId) return;
    this.items.get(this.activeId)?.onInteract();
  }

  private clearActive(): void {
    if (this.activeId !== null) {
      this.activeId = null;
      eventBus.emit("interaction:cleared");
    }
  }
}
