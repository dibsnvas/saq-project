/**
 * Проверяет, что наборы ключей русской и казахской локалей совпадают.
 * Запуск: npm run check:locales (входит в npm run verify).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Пары файлов, которые обязаны иметь одинаковую структуру ключей. */
const PAIRS = [
  ["src/messages/ru.json", "src/messages/kk.json"],
  ["src/content/fire-school/ru.json", "src/content/fire-school/kk.json"],
  ["src/content/fire-mall/ru.json", "src/content/fire-mall/kk.json"],
  ["src/content/fire-apartment/ru.json", "src/content/fire-apartment/kk.json"],
  ["src/content/fire-office/ru.json", "src/content/fire-office/kk.json"],
  [
    "src/content/fire-mall/messages.ru.json",
    "src/content/fire-mall/messages.kk.json",
  ],
  [
    "src/content/fire-apartment/messages.ru.json",
    "src/content/fire-apartment/messages.kk.json",
  ],
  [
    "src/content/fire-office/messages.ru.json",
    "src/content/fire-office/messages.kk.json",
  ],
];

function collectKeys(value, prefix = "") {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return [prefix];
  }
  return Object.entries(value).flatMap(([key, child]) =>
    collectKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

let failed = false;

for (const [ruPath, kkPath] of PAIRS) {
  const ru = JSON.parse(readFileSync(join(root, ruPath), "utf8"));
  const kk = JSON.parse(readFileSync(join(root, kkPath), "utf8"));

  const ruKeys = new Set(collectKeys(ru));
  const kkKeys = new Set(collectKeys(kk));

  const missingInKk = [...ruKeys].filter((k) => !kkKeys.has(k));
  const missingInRu = [...kkKeys].filter((k) => !ruKeys.has(k));

  if (missingInKk.length || missingInRu.length) {
    failed = true;
    console.error(`✗ Расхождение ключей: ${ruPath} ↔ ${kkPath}`);
    for (const k of missingInKk) console.error(`  отсутствует в kk: ${k}`);
    for (const k of missingInRu) console.error(`  отсутствует в ru: ${k}`);
  } else {
    console.log(`✓ ${ruPath} ↔ ${kkPath}: ${ruKeys.size} ключей совпадают`);
  }
}

process.exit(failed ? 1 : 0);
