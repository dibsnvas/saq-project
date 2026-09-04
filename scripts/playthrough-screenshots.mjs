/**
 * Manual playthrough helper for screenshots + smoke checks.
 * Run while `npm run dev` is up (default :3002 if 3000 busy).
 *
 *   node scripts/playthrough-screenshots.mjs [baseUrl]
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const shotDir = join(root, "docs/screenshots/expanded-scenario");
const base = process.argv[2] || "http://localhost:3002";

mkdirSync(shotDir, { recursive: true });

async function waitScene(page) {
  await page.waitForFunction(
    () => {
      const g = window.__saqGame;
      const s = g?.scene?.getScene?.("SchoolScene");
      return Boolean(s?.player && s?.layout && s.scenarioState?.firstDecision);
    },
    null,
    { timeout: 25000 },
  );
}

async function startScenario(page, locale, decisionRegex) {
  await page.goto(`${base}/${locale}/play/fire-school`);
  await page.waitForTimeout(1200);
  const startName = locale === "kk" ? /Сценарийді бастау/i : /Начать сценарий/i;
  await page.getByRole("button", { name: startName }).click();
  await page.waitForTimeout(800);
  for (const name of [
    /Өткізіп жіберу/i,
    /Жалғастыру/i,
    /Пропустить/i,
    /Продолжить/i,
  ]) {
    const b = page.getByRole("button", { name });
    if (await b.count()) {
      await b.first().click();
      await page.waitForTimeout(350);
    }
  }
  await page.locator("button").filter({ hasText: decisionRegex }).click();
  await waitScene(page);
  await page.waitForTimeout(1200);
}

async function go(page, room, spawn) {
  await page.evaluate(
    ({ room, spawn }) => {
      const s = window.__saqGame.scene.getScene("SchoolScene");
      s.transitioning = false;
      s.cameras.main.resetFX();
      s.cameras.main.setAlpha(1);
      s.loadRoom(room, spawn);
    },
    { room, spawn },
  );
  await page.waitForTimeout(500);
}

async function shot(page, name) {
  await page.screenshot({ path: join(shotDir, name), type: "png" });
  console.log("shot", name);
}

async function info(page) {
  return page.evaluate(() => {
    const s = window.__saqGame.scene.getScene("SchoolScene");
    return {
      room: s.layout.id,
      smoke: s.smokeStage,
      completed: s.engine.isCompleted(),
      assessed: s.corridorAssessed,
      decision: s.scenarioState.firstDecision,
    };
  });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

try {
  // Debug classroom
  await page.goto(
    `${base}/kk/play/fire-school?debugCollisions=1&debugNpcPaths=1`,
  );
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /Сценарийді бастау/i }).click();
  await page.waitForTimeout(800);
  for (const name of [/Өткізіп жіберу/i, /Жалғастыру/i]) {
    const b = page.getByRole("button", { name });
    if (await b.count()) {
      await b.first().click();
      await page.waitForTimeout(350);
    }
  }
  await page.locator("button").filter({ hasText: /Жағдайды бағалап/ }).click();
  await waitScene(page);
  await page.waitForTimeout(3500);
  await shot(page, "01-classroom-debug-npc-paths.png");
  console.log("debug", await info(page));

  // Safe path A
  await startScenario(page, "kk", /Жағдайды бағалап/);
  await shot(page, "02-classroom.png");
  await go(page, "corridor", "fromClassroom");
  await shot(page, "03-corridor-light-smoke.png");
  await page.evaluate(() => {
    const s = window.__saqGame.scene.getScene("SchoolScene");
    s.corridorAssessed = true;
    s.engine.dispatchEvent("assessed_corridor", {
      x: s.player.x,
      y: s.player.y,
    });
  });
  await go(page, "central_hall", "fromCorridor");
  console.log("hall enter", await info(page));
  await shot(page, "04-central-hall-distant.png");
  await page.evaluate(() => {
    const s = window.__saqGame.scene.getScene("SchoolScene");
    s.advanceSmokeStage("light");
    s.advanceSmokeStage("medium");
  });
  await page.waitForTimeout(1800);
  console.log("medium", await info(page));
  await shot(page, "05-central-hall-medium-redirect.png");
  await page.evaluate(() =>
    window.__saqGame.scene.getScene("SchoolScene").advanceSmokeStage("blocked"),
  );
  await page.waitForTimeout(1500);
  await shot(page, "06-central-hall-blocked.png");
  await page.evaluate(() => {
    const s = window.__saqGame.scene.getScene("SchoolScene");
    s.player.setPosition(640, 500);
    s.interactions.update(640, 500);
    s.interactions.tryInteract();
  });
  await page.waitForTimeout(600);
  await shot(page, "07-evacuation-plan.png");
  await page.evaluate(() => {
    const s = window.__saqGame.scene.getScene("SchoolScene");
    s.engine.dispatchEvent("changed_route_after_smoke", {
      x: s.player.x,
      y: s.player.y,
    });
    s.telemetry?.record?.("used_emergency_exit", 980, 460, {
      room: "central_hall",
    });
  });
  // telemetry is on scene directly
  await page.evaluate(() => {
    const s = window.__saqGame.scene.getScene("SchoolScene");
    s.engine.dispatchEvent("used_emergency_exit", { x: 980, y: 460 });
  });
  await go(page, "stairs", "fromCentralHall");
  await shot(page, "08-stairs.png");
  await page.evaluate(() => {
    const s = window.__saqGame.scene.getScene("SchoolScene");
    s.engine.dispatchEvent("took_calm_lane", { x: 800, y: 650 });
    s.telemetry?.record?.("descended_stairs", 520, 690, { room: "stairs" });
  });
  await go(page, "vestibule", "fromStairs");
  await shot(page, "09-vestibule.png");
  await page.evaluate(() => {
    const s = window.__saqGame.scene.getScene("SchoolScene");
    s.telemetry?.record?.("exited_building", 640, 590, { room: "vestibule" });
  });
  await go(page, "outdoor", "fromVestibule");
  await shot(page, "10-outdoor.png");
  // Safe run: не трогаем reentry — иначе debrief станет risky.
  await page.evaluate(() => {
    const s = window.__saqGame.scene.getScene("SchoolScene");
    s.player.setPosition(860, 568);
    s.engine.dispatchEvent("reached_assembly", { x: 900, y: 500 });
    s.interactions.update(860, 568);
    s.interactions.tryInteract();
  });
  // Outdoor completion beat (~4.2s) before DebriefPanel.
  await page.waitForTimeout(5500);
  console.log("safe done", await info(page));
  await shot(page, "11-safe-debrief.png");

  // Risky path B
  await startScenario(page, "ru", /Сразу выбежать/);
  await page.evaluate(() => {
    const s = window.__saqGame.scene.getScene("SchoolScene");
    s.transitioning = false;
    s.cameras.main.resetFX();
    s.cameras.main.setAlpha(1);
    s.loadRoom("corridor", "fromClassroom");
    s.engine.dispatchEvent("followed_crowd_without_checking", {
      x: 600,
      y: 500,
    });
    s.loadRoom("central_hall", "fromCorridor");
    s.advanceSmokeStage("medium");
    s.player.setPosition(300, 480);
    s.engine.dispatchEvent("smoke_detected", { x: 300, y: 480 });
    s.engine.dispatchEvent("route_blocked", { x: 300, y: 480 });
    s.loadRoom("stairs", "fromCentralHall");
    s.engine.dispatchEvent("pushed_through_crowd", { x: 500, y: 600 });
    s.loadRoom("vestibule", "fromStairs");
    s.loadRoom("outdoor", "fromVestibule");
    s.player.setPosition(80, 620);
    s.engine.update(80, 620);
    s.player.setPosition(860, 568);
    s.engine.dispatchEvent("reached_assembly", { x: 900, y: 500 });
    s.interactions.update(860, 568);
    s.interactions.tryInteract();
  });
  await page.waitForTimeout(5500);
  console.log("risky done", await info(page));
  await shot(page, "12-risky-debrief.png");

  console.log("OK all screenshots ->", shotDir);
} finally {
  await browser.close();
}
