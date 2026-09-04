"use client";

import { useEffect, useRef } from "react";
import type Phaser from "phaser";

/**
 * Единственная точка контакта React ↔ Phaser-инстанс.
 * Создаёт игру строго один раз на маунт и полностью уничтожает её на анмаунт —
 * ни hot reload, ни навигация не оставляют второй Canvas.
 */
export default function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    let disposed = false;

    (async () => {
      // Phaser импортируется только здесь, в браузере.
      const { createGame } = await import("@/game/config");
      if (disposed || !containerRef.current || gameRef.current) return;
      gameRef.current = createGame(containerRef.current);
    })();

    return () => {
      disposed = true;
      gameRef.current?.destroy(true);
      gameRef.current = null;
      if (typeof window !== "undefined") {
        const w = window as unknown as { __saqGame?: Phaser.Game | null };
        w.__saqGame = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 [&_canvas]:mx-auto [&_canvas]:max-h-full [&_canvas]:max-w-full"
    />
  );
}
