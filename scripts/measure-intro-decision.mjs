/**
 * Измеряет latency skip/fallback → DecisionOverlay на живом URL.
 *
 *   node scripts/measure-intro-decision.mjs [baseUrl]
 *
 * Threshold для CI: 1200ms. Локально ожидаем ≤800ms.
 */
import { chromium } from "playwright";

const base = process.argv[2] || "http://localhost:3000";
const THRESHOLD_MS = Number(process.env.SAQ_INTRO_DECISION_MS || 1200);

async function openPlay(page) {
  await page.goto(`${base}/kk/play/fire-school`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(1500);
}

async function measure(mode) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await openPlay(page);

  const startBtn = page.getByRole("button", {
    name: /Сценарийді бастау|Начать сценарий/i,
  });
  const continueBtn = page.getByRole("button", {
    name: /Жалғастыру|Продолжить/i,
  });
  const skipBtn = page.getByRole("button", {
    name: /Өткізіп жіберу|Пропустить/i,
  });
  const decisionBtn = page.getByRole("button", {
    name: /Мұғалімнің нұсқауын|Следовать указаниям/i,
  });

  let endedAt = 0;

  if (mode === "fallback") {
    // Уже error-экран (headless часто ломает video), либо форсим error после Start.
    if (await continueBtn.count()) {
      endedAt = Date.now();
      await continueBtn.first().click();
    } else {
      await startBtn.click();
      await page.waitForTimeout(300);
      await page.evaluate(() => {
        document.querySelector("video")?.dispatchEvent(new Event("error"));
      });
      await continueBtn.waitFor({ timeout: 5000 });
      endedAt = Date.now();
      await continueBtn.click();
    }
  } else {
    // skip: если видео недоступно — измеряем fallback Continue (тот же finishIntro).
    if (await continueBtn.count()) {
      endedAt = Date.now();
      await continueBtn.first().click();
    } else {
      await startBtn.click();
      await skipBtn.waitFor({ timeout: 15000 });
      endedAt = Date.now();
      await skipBtn.click();
    }
  }

  await decisionBtn.waitFor({ timeout: 5000 });
  const delta = Date.now() - endedAt;

  const optionCount = await page
    .locator("button")
    .filter({
      hasText:
        /Мұғалімнің нұсқауын|Сөмкені|дәлізге|бағалап|Следовать|рюкзак|Выбежать|Оценить/i,
    })
    .count();

  await browser.close();
  return { mode, delta, optionCount };
}

let failed = 0;
for (const mode of ["skip", "fallback"]) {
  try {
    const result = await measure(mode);
    const ok = result.delta <= THRESHOLD_MS && result.optionCount >= 4;
    if (!ok) failed += 1;
    console.log(
      `${ok ? "✓" : "✗"} ${mode}: ${result.delta}ms, options≈${result.optionCount} (threshold ${THRESHOLD_MS}ms)`,
    );
  } catch (err) {
    failed += 1;
    console.log(`✗ ${mode}: ${err instanceof Error ? err.message : err}`);
  }
}

process.exitCode = failed === 0 ? 0 : 1;
