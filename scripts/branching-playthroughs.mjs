/**
 * Branching playthroughs A–F: прогоняет шесть образовательных веток,
 * проверяет итоговый profile.outcome и складывает скриншоты в
 * docs/screenshots/branching-outcomes. Запуск при поднятом dev-сервере:
 *
 *   node scripts/branching-playthroughs.mjs [baseUrl]
 *
 * Гибрид: решения/двери/зоны проходятся через реальные interactions и
 * trigger-зоны сцены; ожидания дыма ускоряются advanceSmokeStage.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const shotDir = join(root, "docs/screenshots/branching-outcomes");
const base = process.argv[2] || "http://localhost:3002";

mkdirSync(shotDir, { recursive: true });

let failures = 0;

async function startScenario(page, locale, decisionRegex) {
  await page.goto(`${base}/${locale}/play/fire-school`);
  await page.waitForTimeout(1600);
  // Headless: видео может не загрузиться → fallback-кнопка «Продолжить».
  const entryButtons = [
    locale === "kk" ? /Сценарийді бастау/i : /Начать сценарий/i,
    /Жалғастыру/i,
    /Продолжить/i,
  ];
  for (const name of entryButtons) {
    const b = page.getByRole("button", { name });
    if (await b.count()) {
      await b.first().click();
      break;
    }
  }
  await page.waitForTimeout(800);
  for (const name of [/Өткізіп жіберу/i, /Пропустить/i, /Жалғастыру/i, /Продолжить/i]) {
    const b = page.getByRole("button", { name });
    if (await b.count()) {
      await b.first().click();
      await page.waitForTimeout(350);
    }
  }
  // Отчёт завершения ловим с шины (React-сторона получает тот же payload).
  await page.evaluate(() => {
    window.__lastReport = null;
    window.__saqEventBus.on(
      "scenario:completed",
      (p) => (window.__lastReport = p.report),
    );
  });
  await page.locator("button").filter({ hasText: decisionRegex }).click();
  await page.waitForFunction(
    () => {
      const s = window.__saqGame?.scene?.getScene?.("SchoolScene");
      return Boolean(s?.player && s?.layout && s.scenarioState?.firstDecision);
    },
    null,
    { timeout: 25000 },
  );
  await page.waitForTimeout(1000);
}

/** Ставит игрока в точку; сцена сама прогонит зоны/auto-exit в update. */
async function place(page, x, y) {
  await page.evaluate(
    ({ x, y }) => {
      const s = window.__saqGame.scene.getScene("SchoolScene");
      s.player.setPosition(x, y);
    },
    { x, y },
  );
  await page.waitForTimeout(120);
}

/** Реальное взаимодействие (двери, план, помощь, доклад). */
async function interactAt(page, x, y) {
  await place(page, x, y);
  await page.evaluate(
    ({ x, y }) => {
      const s = window.__saqGame.scene.getScene("SchoolScene");
      s.interactions.update(x, y);
      s.interactions.tryInteract();
    },
    { x, y },
  );
  await page.waitForTimeout(1100); // fade перехода
}

/** Короткий ChoiceOverlay (ученица). */
async function chooseOverlay(page, labelRegex) {
  const btn = page.getByRole("button", { name: labelRegex });
  await btn.waitFor({ timeout: 5000 });
  await btn.click();
  await page.waitForTimeout(400);
}

async function advanceSmoke(page, stage) {
  await page.evaluate(
    (stage) => {
      const s = window.__saqGame.scene.getScene("SchoolScene");
      s.advanceSmokeStage(stage);
    },
    stage,
  );
  await page.waitForTimeout(400);
}

async function waitRoom(page, id, timeout = 8000) {
  await page.waitForFunction(
    (id) =>
      window.__saqGame?.scene?.getScene?.("SchoolScene")?.layout?.id === id,
    id,
    { timeout },
  );
  await page.waitForTimeout(400);
}

async function shot(page, name) {
  await page.screenshot({ path: join(shotDir, name), type: "png" });
  console.log("  shot", name);
}

async function finish(page, expectedOutcome, label) {
  // Точка сбора → реальный доклад учителю → outdoor beat (~4.2s) → debrief.
  await place(page, 900, 520);
  await page.waitForTimeout(600);
  await interactAt(page, 860, 568);
  await page.waitForFunction(() => Boolean(window.__lastReport), null, {
    timeout: 12000,
  });
  const report = await page.evaluate(() => window.__lastReport);
  const got = report?.profile?.outcome;
  const ok = got === expectedOutcome;
  if (!ok) failures += 1;
  console.log(
    `${ok ? "✓" : "✗"} ${label}: outcome=${got} (ожидалось ${expectedOutcome})`,
    report?.profile
      ? {
          safety: report.profile.safety,
          awareness: report.profile.awareness,
          completion: report.profile.completion,
          interventions: report.profile.teacherInterventions,
          corrections: report.profile.correctedMistakes,
          companion: report.profile.companion,
        }
      : "(нет отчёта)",
  );
  return report;
}

/** corridor → hall реальным auto-exit (дальняя часть коридора). */
async function corridorToHall(page) {
  await place(page, 650, 390);
  await waitRoom(page, "central_hall");
}

async function stairsToVestibuleToOutdoor(page, { push = false, calm = false }) {
  if (push) {
    await place(page, 500, 600); // плотная группа
    await page.waitForTimeout(700);
  }
  if (calm) {
    await place(page, 820, 660); // свободный проход
    await page.waitForTimeout(700);
  }
  await place(page, 500, 690); // auto-exit вниз
  await waitRoom(page, "vestibule");
  await place(page, 640, 590); // открытые двери
  await waitRoom(page, "outdoor");
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

try {
  // ---------- A. Independent plan (kk): assess → помощь → план → calm lane
  await startScenario(page, "kk", /Жағдайды бағалап/);
  await interactAt(page, 1140, 522); // дверь класса
  await waitRoom(page, "corridor");
  await page.waitForTimeout(1600); // заминка → assessed_corridor
  await interactAt(page, 885, 535); // разговор с ученицей
  await chooseOverlay(page, /Бірге жүрейік|Пойдём вместе/i);
  await corridorToHall(page);
  await shot(page, "01-central-hall-distant-smoke.png");
  await interactAt(page, 640, 455); // план эвакуации
  await shot(page, "02-evacuation-plan-interaction.png");
  await advanceSmoke(page, "light");
  await advanceSmoke(page, "medium");
  await page.waitForTimeout(1500);
  await shot(page, "03-independent-plan-branch.png");
  await interactAt(page, 980, 455); // запасной выход
  await waitRoom(page, "stairs");
  await place(page, 820, 660);
  await page.waitForTimeout(700);
  await shot(page, "04-calm-lane.png");
  await stairsToVestibuleToOutdoor(page, { calm: true });
  const a = await finish(page, "safe_independent", "A independent plan (kk)");
  await shot(page, "09-debrief-safe-independent.png");
  if (a?.profile?.companion !== "safe_at_assembly") {
    failures += 1;
    console.log("✗ A: companion ожидалась safe_at_assembly:", a?.profile?.companion);
  }

  // ---------- B. Independent sign (ru): без плана, знак справа
  await startScenario(page, "ru", /Оценить обстановку/);
  await interactAt(page, 1140, 522);
  await waitRoom(page, "corridor");
  await page.waitForTimeout(1600);
  await corridorToHall(page);
  await interactAt(page, 920, 470); // знак ҚОСАЛҚЫ ШЫҒУ (interaction)
  await page.waitForTimeout(400);
  await shot(page, "05-independent-sign-branch.png");
  await interactAt(page, 980, 455);
  await waitRoom(page, "stairs");
  await stairsToVestibuleToOutdoor(page, {});
  await finish(page, "safe_independent", "B independent sign (ru)");

  // ---------- C. Teacher guidance (ru): rush → мимо всего → linger у дыма
  await startScenario(page, "ru", /Сразу выбежать/);
  await interactAt(page, 1140, 522);
  await waitRoom(page, "corridor");
  await page.waitForTimeout(2100); // rush-заминка (контроль заблокирован)
  await corridorToHall(page); // без остановки → followed_crowd
  await advanceSmoke(page, "light");
  await advanceSmoke(page, "medium");
  await place(page, 380, 480); // в danger-зону и стоим
  await page.waitForTimeout(5600); // route_blocked (2.5s) + linger → вмешательство
  await shot(page, "06-teacher-intervention.png");
  await interactAt(page, 980, 455);
  await waitRoom(page, "stairs");
  await stairsToVestibuleToOutdoor(page, {});
  await finish(page, "safe_with_guidance", "C teacher guidance (ru)");
  await shot(page, "10-debrief-safe-with-guidance.png");

  // ---------- D. Risky but complete (ru): backpack → толпа → давка → reentry
  await startScenario(page, "ru", /Сначала забрать рюкзак/);
  await page.waitForTimeout(3500); // scripted-возврат за рюкзаком
  await interactAt(page, 1140, 522);
  await waitRoom(page, "corridor");
  await corridorToHall(page); // без оценки
  await advanceSmoke(page, "light");
  await advanceSmoke(page, "medium");
  await page.waitForTimeout(1200);
  await shot(page, "07-crowd-following-branch.png");
  await interactAt(page, 980, 455); // за толпой к выходу (без плана/знака)
  await waitRoom(page, "stairs");
  await place(page, 500, 600); // давка
  await page.waitForTimeout(800);
  await shot(page, "08-pushing-risk.png");
  await stairsToVestibuleToOutdoor(page, { push: true });
  await place(page, 100, 620); // попытка вернуться к дверям
  await page.waitForTimeout(900);
  await shot(page, "11-attempted-reentry.png");
  await finish(page, "safe_with_risks", "D risky but complete (ru)");
  await shot(page, "12-debrief-safe-with-risks.png");

  // ---------- E. Corrected mistakes (ru): rush → исправления по пути
  await startScenario(page, "ru", /Сразу выбежать/);
  await interactAt(page, 1140, 522);
  await waitRoom(page, "corridor");
  await page.waitForTimeout(2100);
  await corridorToHall(page); // followed_crowd
  await advanceSmoke(page, "light");
  await place(page, 380, 480); // подошёл к дыму…
  await page.waitForTimeout(1500);
  await place(page, 700, 620); // …и сам отошёл (< route_blocked)
  await page.waitForTimeout(600);
  await shot(page, "13-corrected-smoke-mistake.png");
  await interactAt(page, 640, 455); // проверил план → crowd corrected
  await advanceSmoke(page, "medium");
  await page.waitForTimeout(1000);
  await interactAt(page, 980, 455);
  await waitRoom(page, "stairs");
  await place(page, 500, 600); // давка…
  await page.waitForTimeout(800);
  await place(page, 820, 660); // …перешёл в calm lane
  await page.waitForTimeout(800);
  await stairsToVestibuleToOutdoor(page, {});
  // Все ошибки исправлены вовремя + план проверен → по политике это
  // заслуженный safe_independent (исправления при этом видны в дебрифе).
  const e = await finish(page, "safe_independent", "E corrected mistakes (ru)");
  const corr = e?.profile?.correctedMistakes ?? [];
  if (corr.length < 3) {
    failures += 1;
    console.log("✗ E: ожидалось ≥3 исправлений, получено:", corr);
  }

  // ---------- F. Incomplete (kk): вышел, но не доложил → time_up
  await startScenario(page, "kk", /Мұғалімнің нұсқауын/);
  await interactAt(page, 1140, 522);
  await waitRoom(page, "corridor");
  await page.waitForTimeout(1600);
  await corridorToHall(page);
  await advanceSmoke(page, "medium");
  await page.waitForTimeout(800);
  await interactAt(page, 980, 455);
  await waitRoom(page, "stairs");
  await stairsToVestibuleToOutdoor(page, {});
  await place(page, 400, 600); // стоит во дворе, не доложил
  await page.evaluate(() => {
    const s = window.__saqGame.scene.getScene("SchoolScene");
    s.engine.dispatchEvent("time_up", { x: s.player.x, y: s.player.y });
  });
  await page.waitForTimeout(1600);
  const f = await page.evaluate(() => window.__lastReport);
  const fOk = f?.profile?.outcome === "incomplete";
  if (!fOk) failures += 1;
  console.log(
    `${fOk ? "✓" : "✗"} F incomplete (kk): outcome=${f?.profile?.outcome}`,
  );
  await shot(page, "14-debrief-incomplete.png");

  console.log(
    failures === 0
      ? `\nOK: все ветки сошлись. Скриншоты → ${shotDir}`
      : `\nFAIL: ${failures} расхождений`,
  );
  process.exitCode = failures === 0 ? 0 : 1;
} finally {
  await browser.close();
}
