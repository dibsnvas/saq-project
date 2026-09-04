"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { eventBus } from "@/game/EventBus";

/**
 * Мини-карта (правый верхний угол): схематичная, не «чит-карта».
 * Progressive discovery: сегменты появляются по мере посещения комнат;
 * запасной маршрут (лестница) подсвечивается после плана эвакуации или
 * обнаружения дыма; точка сбора — во дворе. Весь маршрут заранее не виден.
 * Companion (одноклассница) — маленькая зелёная точка рядом с игроком.
 */

interface SchematicRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Схематичные сегменты (viewBox 100×76). Маршрут:
 * classroom → corridor → central_hall → stairs → vestibule → outdoor.
 */
const ROOMS: Record<string, SchematicRect> = {
  classroom: { x: 66, y: 55, w: 28, h: 16 },
  corridor: { x: 52, y: 42, w: 42, h: 9 },
  central_hall: { x: 26, y: 38, w: 22, h: 17 },
  stairs: { x: 8, y: 36, w: 14, h: 20 },
  vestibule: { x: 8, y: 22, w: 16, h: 10 },
  outdoor: { x: 6, y: 4, w: 88, h: 13 },
};

/** Нормализованные координаты комнаты → точка схемы. */
function toSchematic(room: string, nx: number, ny: number) {
  const r = ROOMS[room];
  if (!r) return { cx: 50, cy: 40 };
  switch (room) {
    case "corridor":
      // Вглубь коридора (к холлу) = влево по схеме.
      return { cx: r.x + 3 + ny * (r.w - 6), cy: r.y + 2.5 + nx * (r.h - 5) };
    case "stairs":
      return { cx: r.x + 3 + nx * (r.w - 6), cy: r.y + 3 + ny * (r.h - 6) };
    case "outdoor":
      return { cx: r.x + 4 + nx * (r.w - 8), cy: r.y + 3 + ny * (r.h - 6) };
    default:
      return { cx: r.x + 3 + nx * (r.w - 6), cy: r.y + 3 + ny * (r.h - 6) };
  }
}

/** Связки сегментов: рисуются, когда обе комнаты открыты. */
const LINKS: Array<{
  a: string;
  b: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}> = [
  { a: "classroom", b: "corridor", x1: 80, y1: 55, x2: 80, y2: 51 },
  { a: "corridor", b: "central_hall", x1: 52, y1: 46.5, x2: 48, y2: 46.5 },
  { a: "central_hall", b: "stairs", x1: 26, y1: 46.5, x2: 22, y2: 46.5 },
  { a: "stairs", b: "vestibule", x1: 15, y1: 36, x2: 15, y2: 32 },
  { a: "vestibule", b: "outdoor", x1: 15, y1: 22, x2: 15, y2: 17 },
];

type CompanionState = "none" | "following" | "safe";

export function Minimap() {
  const t = useTranslations();
  const [room, setRoom] = useState("classroom");
  const [pos, setPos] = useState({ x: 0.5, y: 0.8 });
  const [visited, setVisited] = useState<string[]>(["classroom"]);
  const [smokeDetected, setSmokeDetected] = useState(false);
  const [doorHint, setDoorHint] = useState(false);
  const [planChecked, setPlanChecked] = useState(false);
  /** знак запасного выхода / вмешательство учителя — тоже открывают сегмент */
  const [routeHint, setRouteHint] = useState(false);
  const [companion, setCompanion] = useState<CompanionState>("none");

  useEffect(() => {
    const reset = () => {
      setSmokeDetected(false);
      setDoorHint(false);
      setPlanChecked(false);
      setRouteHint(false);
      setCompanion("none");
      setVisited(["classroom"]);
      setRoom("classroom");
      setPos({ x: 0.5, y: 0.8 });
    };
    const unsubscribes = [
      eventBus.on("room:changed", ({ room: r }) => {
        setRoom(r);
        setVisited((prev) => (prev.includes(r) ? prev : [...prev, r]));
      }),
      eventBus.on("minimap:update", ({ room: r, x, y }) => {
        setRoom(r);
        setPos({ x, y });
      }),
      eventBus.on("scenario:event", ({ id }) => {
        if (id === "smoke_detected" || id === "route_smoke_warning") {
          setSmokeDetected(true);
        }
        if (id === "assessed_environment") setDoorHint(true);
        if (id === "evacuation_plan_checked") setPlanChecked(true);
        // Знак или вмешательство учителя открывают ближайший запасной
        // сегмент; «шёл только за толпой» подсказок не даёт.
        if (
          id === "safe_exit_sign_detected" ||
          id === "teacher_intervened" ||
          id === "teacher_instruction_followed"
        ) {
          setRouteHint(true);
        }
        if (id === "helped_student") setCompanion("following");
        if (id === "companion_safe") setCompanion("safe");
      }),
      eventBus.on("game:restart", reset),
    ];
    return () => unsubscribes.forEach((off) => off());
  }, []);

  const isVisited = (id: string) => visited.includes(id);
  /** Запасной сегмент виден после плана / знака / вмешательства учителя. */
  const isRevealed = (id: string) =>
    isVisited(id) || (id === "stairs" && (planChecked || routeHint));
  const { cx, cy } = toSchematic(room, pos.x, pos.y);
  const label = planChecked
    ? `${t("game.minimapLabel")}. ${t("game.youAreHere")}`
    : t("game.minimapLabel");

  return (
    <div className="pointer-events-none rounded-xl border border-white/15 bg-navy-900/80 p-1.5 shadow-lg backdrop-blur-sm">
      <svg
        width="132"
        height="100"
        viewBox="0 0 100 76"
        role="img"
        aria-label={label}
      >
        {/* сегменты маршрута — только открытые */}
        {Object.entries(ROOMS).map(([id, r]) =>
          isRevealed(id) ? (
            <rect
              key={id}
              x={r.x}
              y={r.y}
              width={r.w}
              height={r.h}
              rx="2.5"
              fill={
                id === room ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.05)"
              }
              stroke={
                !isVisited(id)
                  ? "rgba(47,174,95,0.6)"
                  : "rgba(255,255,255,0.28)"
              }
              strokeWidth="1"
              strokeDasharray={!isVisited(id) ? "2.5 1.8" : undefined}
            />
          ) : null,
        )}

        {LINKS.map((l) =>
          isRevealed(l.a) && isRevealed(l.b) ? (
            <line
              key={`${l.a}-${l.b}`}
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              stroke="rgba(255,255,255,0.28)"
              strokeWidth="1.4"
            />
          ) : null,
        )}

        {doorHint && isVisited("classroom") && !isVisited("corridor") && (
          <circle cx="88" cy="58" r="2" fill="#2fae5f" />
        )}

        {isVisited("central_hall") && (
          <g>
            <rect
              x="27.5"
              y="30"
              width="9"
              height="7"
              rx="1.8"
              fill={
                smokeDetected
                  ? "rgba(216,58,58,0.35)"
                  : "rgba(255,255,255,0.06)"
              }
              stroke={smokeDetected ? "#d83a3a" : "rgba(255,255,255,0.2)"}
              strokeWidth="1"
            />
            {smokeDetected && (
              <>
                <line
                  x1="29"
                  y1="31.2"
                  x2="35"
                  y2="35.8"
                  stroke="#d83a3a"
                  strokeWidth="1.3"
                />
                <line
                  x1="35"
                  y1="31.2"
                  x2="29"
                  y2="35.8"
                  stroke="#d83a3a"
                  strokeWidth="1.3"
                />
              </>
            )}
          </g>
        )}

        {/* Зелёная точка запасного выхода — только когда есть источник */}
        {isVisited("central_hall") && (planChecked || routeHint) && (
          <circle cx="27" cy="46.5" r="2.2" fill="#2fae5f" />
        )}

        {isVisited("outdoor") && (
          <g>
            <circle
              cx="72"
              cy="10.5"
              r="3.2"
              fill="none"
              stroke="#2fae5f"
              strokeWidth="1.3"
            />
            <circle cx="72" cy="10.5" r="1.2" fill="#2fae5f" />
          </g>
        )}

        {companion === "following" && (
          <circle cx={cx - 4.2} cy={cy + 2.6} r="1.5" fill="#7fd6a2" />
        )}
        {companion === "safe" && (
          <circle cx="76.5" cy="12.5" r="1.5" fill="#7fd6a2" />
        )}

        <circle cx={cx} cy={cy} r="3.4" fill="rgba(255,255,255,0.25)" />
        {planChecked && (
          <circle
            cx={cx}
            cy={cy}
            r="5"
            fill="none"
            stroke="#2fae5f"
            strokeWidth="1"
          />
        )}
        <circle
          cx={cx}
          cy={cy}
          r="1.9"
          fill="#ffffff"
          style={{ transition: "cx 120ms linear, cy 120ms linear" }}
        />
      </svg>
    </div>
  );
}
