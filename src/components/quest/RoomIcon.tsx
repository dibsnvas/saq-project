import type { QuestIcon } from "@/quest/schema";

/**
 * Линейные иконки комнат квеста. Никакого текста внутри — только силуэт
 * места действия: одна визуальная опора для комнаты без готового арта.
 */
const PATHS: Record<QuestIcon, React.ReactNode> = {
  apartment: (
    <>
      <path d="M4 11.5 12 5l8 6.5" />
      <path d="M6 11v8h12v-8" />
      <path d="M10 19v-4h4v4" />
    </>
  ),
  elevator: (
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
      <path d="M12 3.5v17" />
      <path d="M9 9.5 7.5 7.5 6 9.5" />
      <path d="M18 14.5 16.5 16.5 15 14.5" />
    </>
  ),
  school: (
    <>
      <path d="M3.5 20.5h17" />
      <path d="M5 20.5V9l7-4.5L19 9v11.5" />
      <path d="M9.5 20.5v-6h5v6" />
      <path d="M12 4.5V2.5" />
    </>
  ),
  mall: (
    <>
      <path d="M5 8h14l-1.2 12.5H6.2L5 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
  street: (
    <>
      <path d="M3.5 20.5h17" />
      <path d="M4.5 20.5V7h6v13.5" />
      <path d="M13.5 20.5V11h6v9.5" />
      <path d="M2.5 4.5c3.5 2 6.5 2 10 0s6.5-2 9 0" />
    </>
  ),
  car: (
    <>
      <path d="M3.5 16v-3l2-5h13l2 5v3" />
      <path d="M3.5 16h17" />
      <path d="M5.5 16v2.5M18.5 16v2.5" />
      <path d="M6 13h3M15 13h3" />
    </>
  ),
  night: (
    <>
      <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z" />
      <path d="M16 4.5h3M17.5 3v3" />
    </>
  ),
  gas: (
    <>
      <path d="M12 3.5c3 3.5 5 6 5 9a5 5 0 0 1-10 0c0-1.6.7-3 1.8-4.4.6 1.2 1.4 1.8 2.2 1.8 0-2 .3-4.2 1-6.4Z" />
      <path d="M4 20.5h16" />
    </>
  ),
  help: (
    <>
      <circle cx="8.5" cy="7" r="2.5" />
      <path d="M4 20v-2.5A3.5 3.5 0 0 1 7.5 14h2A3.5 3.5 0 0 1 13 17.5V20" />
      <circle cx="17" cy="9.5" r="2" />
      <path d="M14 20v-2a3 3 0 0 1 3-3h.5a3 3 0 0 1 3 3v2" />
    </>
  ),
  evacuation: (
    <>
      <path d="M4.5 3.5h8v17h-8z" />
      <path d="M9.5 12h0.01" />
      <path d="M14 12h6" />
      <path d="M17.5 9 20.5 12l-3 3" />
    </>
  ),
};

export function RoomIcon({
  icon,
  className = "",
}: {
  icon: QuestIcon;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[icon]}
    </svg>
  );
}
