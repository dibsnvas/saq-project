import Phaser from "phaser";
import { eventBus } from "../EventBus";

type MoveKeys = {
  W: Phaser.Input.Keyboard.Key;
  A: Phaser.Input.Keyboard.Key;
  S: Phaser.Input.Keyboard.Key;
  D: Phaser.Input.Keyboard.Key;
};

/**
 * Объединяет клавиатуру (WASD, стрелки, E/Enter, Escape) и виртуальный
 * джойстик (события input:move / input:interact с шины) в единый вектор
 * движения и запрос взаимодействия.
 */
export class InputController {
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: MoveKeys;
  private keyE?: Phaser.Input.Keyboard.Key;
  private keyEnter?: Phaser.Input.Keyboard.Key;
  private virtual = { x: 0, y: 0 };
  private virtualInteract = false;
  private unsubscribes: Array<() => void> = [];
  private moveVector = new Phaser.Math.Vector2();

  constructor(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    if (keyboard) {
      this.cursors = keyboard.createCursorKeys();
      this.wasd = keyboard.addKeys("W,A,S,D") as MoveKeys;
      this.keyE = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
      this.keyEnter = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

      // Escape ставит игру на паузу. Возобновление — только со стороны React
      // (оверлей паузы), потому что у приостановленной сцены клавиатура
      // не обрабатывается.
      keyboard
        .addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
        .on("down", () => eventBus.emit("game:pause"));
    }

    this.unsubscribes.push(
      eventBus.on("input:move", (v) => {
        this.virtual = v;
      }),
      eventBus.on("input:interact", () => {
        this.virtualInteract = true;
      }),
    );

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /** Нормализованный вектор движения: диагональ не быстрее прямой. */
  getMoveVector(): Phaser.Math.Vector2 {
    let x =
      (this.cursors?.right.isDown || this.wasd?.D.isDown ? 1 : 0) -
      (this.cursors?.left.isDown || this.wasd?.A.isDown ? 1 : 0);
    let y =
      (this.cursors?.down.isDown || this.wasd?.S.isDown ? 1 : 0) -
      (this.cursors?.up.isDown || this.wasd?.W.isDown ? 1 : 0);

    if (x === 0 && y === 0) {
      // Клавиатура молчит — берём виртуальный джойстик (уже в [-1, 1]).
      x = this.virtual.x;
      y = this.virtual.y;
    }

    this.moveVector.set(x, y);
    if (this.moveVector.lengthSq() > 1) {
      this.moveVector.normalize();
    }
    return this.moveVector;
  }

  /** true один раз на нажатие E/Enter или тап по кнопке действия. */
  consumeInteract(): boolean {
    const keyboardHit =
      (this.keyE ? Phaser.Input.Keyboard.JustDown(this.keyE) : false) ||
      (this.keyEnter ? Phaser.Input.Keyboard.JustDown(this.keyEnter) : false);
    const virtualHit = this.virtualInteract;
    this.virtualInteract = false;
    return keyboardHit || virtualHit;
  }

  private destroy(): void {
    this.unsubscribes.forEach((off) => off());
    this.unsubscribes = [];
  }
}
