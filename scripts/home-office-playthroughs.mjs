/**
 * Прогоны «Пожар · квартира» и «Пожар · офис»: по маршруту «всё верно» и
 * «с ошибками» для каждой локации. Проверяет итог profile.outcome, риски в
 * разборе, ключевые события (крышка, проверка двери, возвращение домой,
 * полотенца, 101, балкон; пригнуться в дыму, лестница вместо лифта) и кнопку
 * следующей локации. Скриншоты — docs/screenshots/home-office.
 * Запуск при поднятом dev-сервере:
 *
 *   node scripts/home-office-playthroughs.mjs [baseUrl]
 *
 * Как и branching-playthroughs.mjs: двери, хотспоты и зоны проходятся через
 * реальные interactions сцены, игрок переставляется по координатам раскладок.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const base = process.argv[2] || "http://localhost:3000";
const shots = join(root, "docs/screenshots/home-office") + "/";
mkdirSync(shots, { recursive: true });
let failures = 0;
const ok = (c, m) => { console.log(`${c ? "✓" : "✗"} ${m}`); if (!c) failures += 1; };
const shot = (p, name) => p.screenshot({ path: `${shots}${name}.png` });

async function place(p, x, y) {
  await p.evaluate(({ x, y }) => window.__saqGame.scene.getScene("SchoolScene").player.setPosition(x, y), { x, y });
  await p.waitForTimeout(140);
}
async function interactAt(p, x, y) {
  await place(p, x, y);
  await p.evaluate(({ x, y }) => { const s = window.__saqGame.scene.getScene("SchoolScene"); s.interactions.update(x, y); s.interactions.tryInteract(); }, { x, y });
  await p.waitForTimeout(1100);
}
async function waitRoom(p, id, timeout = 10000) {
  await p.waitForFunction((id) => window.__saqGame?.scene?.getScene?.("SchoolScene")?.layout?.id === id, id, { timeout });
  await p.waitForTimeout(450);
}
const has = (p, id) => p.evaluate((id) => window.__saqGame.scene.getScene("SchoolScene").engine.hasEvent(id), id);

async function start(p, route, decision) {
  await p.goto(`${base}/ru/play/${route}`);
  await p.waitForFunction(() => Boolean(window.__saqEventBus), null, { timeout: 40000 });
  await p.waitForTimeout(1500);
  for (const name of [/Начать сценарий/i, /Продолжить/i]) { const b = p.getByRole("button", { name }); if (await b.count()) { await b.first().click(); break; } }
  await p.waitForTimeout(700);
  for (const name of [/Пропустить/i, /Продолжить/i]) { const b = p.getByRole("button", { name }); if (await b.count()) { await b.first().click(); await p.waitForTimeout(300); } }
  await p.waitForFunction(() => Boolean(window.__saqEventBus), null, { timeout: 30000 });
  await p.evaluate(() => { window.__lastReport = null; window.__saqEventBus.on("scenario:completed", (x) => (window.__lastReport = x.report)); });
  await p.locator("button").filter({ hasText: decision }).first().click();
  await p.waitForFunction(() => { const s = window.__saqGame?.scene?.getScene?.("SchoolScene"); return Boolean(s?.player && s?.layout && s.scenarioState?.firstDecision); }, null, { timeout: 25000 });
  await p.waitForTimeout(800);
}
async function report(p, x, y, label) {
  await place(p, x + 40, y - 10); await p.waitForTimeout(600);
  await interactAt(p, x, y);
  await p.waitForFunction(() => Boolean(window.__lastReport), null, { timeout: 15000 });
  const r = await p.evaluate(() => window.__lastReport);
  console.log(`  ${label}: outcome=${r.profile.outcome}`, { safety: r.profile.safety, awareness: r.profile.awareness, good: r.goodActions.length, risky: r.riskyActions, lesson: r.lessonKey, companion: r.profile.companion });
  return r;
}
async function choose(p, text) {
  const b = p.getByRole("button", { name: text });
  await b.first().waitFor({ timeout: 6000 });
  await b.first().click(); await p.waitForTimeout(500);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("response", (r) => { if (r.status() >= 400 && r.url().includes("/assets/")) errors.push(`${r.status()} ${r.url()}`); });

try {
  // ============ А. Квартира, всё верно
  await start(page, "fire-apartment", /Накрыть сковороду крышкой/);
  await page.waitForTimeout(1800);
  const fire = await page.evaluate(() => { const s = window.__saqGame.scene.getScene("SchoolScene"); return s.eventProps.map((p) => ({ tex: p.def.textureKey, visible: p.img.visible, alpha: +p.img.alpha.toFixed(2) })); });
  ok(fire.find((f) => f.tex.includes("flame"))?.visible === false && fire.find((f) => f.tex.includes("lid"))?.visible === true, `кухня: огонь погас, крышка на сковороде ${JSON.stringify(fire)}`);
  await shot(page, "a01-kitchen-lid");
  await interactAt(page, 1165, 645); await waitRoom(page, "corridor");
  await shot(page, "a02-hallway");
  await interactAt(page, 860, 600); await choose(page, /Держись за меня/);
  ok(await page.evaluate(() => window.__saqGame.scene.getScene("SchoolScene").scenarioState.companionActive), "коридор: сестрёнка идёт с игроком");
  await interactAt(page, 700, 492);
  ok(await has(page, "door_checked"), "коридор: дверь проверена ладонью");
  await interactAt(page, 590, 494); await waitRoom(page, "central_hall");
  ok(!(await has(page, "opened_door_unchecked")), "подъезд: без риска «открыл не проверив»");
  await place(page, 1000, 670); await page.waitForTimeout(3600);
  await shot(page, "a03-landing-smoke");
  ok(await has(page, "smoke_noticed_from_distance"), "подъезд: дым замечен издалека");
  await interactAt(page, 1110, 628); await waitRoom(page, "corridor");
  ok(await has(page, "returned_to_apartment"), "вернулся в квартиру");
  const hotspots = await page.evaluate(() => window.__saqGame.scene.getScene("SchoolScene").interactions.getAll().map((i) => i.id));
  ok(hotspots.includes("seal_door") && hotspots.includes("call_rescue") && hotspots.includes("balcony_door") && !hotspots.includes("front_door"), `после возвращения: ${hotspots.join(", ")}`);
  await interactAt(page, 640, 496); await interactAt(page, 440, 592);
  ok(await has(page, "sealed_door_gaps") && await has(page, "called_rescue"), "щели закрыты, 101 вызван");
  await shot(page, "a04-sealed");
  await interactAt(page, 1010, 640); await page.waitForTimeout(1500);
  await shot(page, "a05-balcony-beat");
  await waitRoom(page, "outdoor", 12000);
  await place(page, 1040, 560); await page.waitForTimeout(700);
  await shot(page, "a06-street");
  const ra = await report(page, 900, 552, "А квартира верно");
  ok(ra.profile.outcome === "safe_independent", "А: итог safe_independent");
  await page.waitForTimeout(5500);
  await shot(page, "a07-debrief");
  const nextHref = await page.getByRole("link", { name: /Следующая локация: офис/ }).getAttribute("href").catch(() => null);
  ok(nextHref?.endsWith("/play/fire-office"), `разбор квартиры → ${nextHref}`);

  // ============ Б. Квартира с ошибками
  await start(page, "fire-apartment", /Залить горящее масло водой/);
  await page.waitForTimeout(800);
  await shot(page, "b01-kitchen-flare");
  await interactAt(page, 1165, 645); await waitRoom(page, "corridor");
  await interactAt(page, 540, 628);
  await interactAt(page, 860, 600); await choose(page, /Жди здесь/);
  await interactAt(page, 590, 494); await waitRoom(page, "central_hall");
  ok(await has(page, "opened_door_unchecked"), "Б: «открыл дверь, не проверив»");
  await page.waitForTimeout(6000);
  await place(page, 780, 585); await page.waitForTimeout(5500);
  await shot(page, "b02-landing-danger");
  await interactAt(page, 1110, 628); await waitRoom(page, "corridor");
  await interactAt(page, 1010, 640); await waitRoom(page, "outdoor", 12000);
  await place(page, 120, 530); await page.waitForTimeout(900);
  const rb = await report(page, 900, 552, "Б квартира с ошибками");
  ok(rb.profile.outcome !== "safe_independent" && rb.riskyActions.includes("debrief.rule.panFlared"), "Б: риски в разборе");

  // ============ В. Офис, всё верно
  await start(page, "fire-office", /Идти с мамой к выходу/);
  await page.waitForTimeout(1500);
  await shot(page, "c01-office-room");
  await interactAt(page, 1060, 522); await waitRoom(page, "corridor");
  await place(page, 700, 640); await place(page, 700, 596);
  await choose(page, /Пригнуться/);
  const crouch = await page.evaluate(() => { const s = window.__saqGame.scene.getScene("SchoolScene"); return { crouched: s.crouched, tex: s.player.texture.key, h: Math.round(s.player.displayHeight) }; });
  ok(crouch.crouched && crouch.tex.includes("crouch"), `коридор: пригнулся ${JSON.stringify(crouch)}`);
  await shot(page, "c02-corridor-crouch");
  await interactAt(page, 490, 540); await choose(page, /Идёмте с нами/);
  await place(page, 690, 410); await waitRoom(page, "central_hall");
  await page.waitForTimeout(3000);
  await interactAt(page, 1090, 610);
  await shot(page, "c03-lift-hall");
  await interactAt(page, 1005, 588); await waitRoom(page, "stairs");
  await place(page, 940, 684); await page.waitForTimeout(700);
  await place(page, 450, 700); await waitRoom(page, "vestibule");
  await shot(page, "c04-lobby");
  await place(page, 635, 600); await waitRoom(page, "outdoor");
  await place(page, 1040, 560); await page.waitForTimeout(700);
  await shot(page, "c05-yard");
  const rc = await report(page, 960, 552, "В офис верно");
  ok(rc.profile.outcome === "safe_independent", "В: итог safe_independent");
  await page.waitForTimeout(5500);
  await shot(page, "c06-debrief");

  // ============ Г. Офис: сборы, в полный рост, стоял у лифта
  await start(page, "fire-office", /Сначала собрать рюкзак/);
  await page.waitForTimeout(10000);
  await interactAt(page, 1060, 522); await waitRoom(page, "corridor");
  await place(page, 700, 640); await place(page, 700, 596);
  await choose(page, /Идти в полный рост/);
  await page.waitForTimeout(600);
  await shot(page, "d01-corridor-upright");
  await place(page, 690, 410); await waitRoom(page, "central_hall");
  await page.waitForTimeout(8000);
  await place(page, 700, 470); await page.waitForTimeout(5500);
  await shot(page, "d02-lift-danger");
  await interactAt(page, 1005, 588); await waitRoom(page, "stairs");
  await place(page, 450, 700); await waitRoom(page, "vestibule");
  await place(page, 635, 600); await waitRoom(page, "outdoor");
  const rd = await report(page, 960, 552, "Г офис с ошибками");
  ok(rd.riskyActions.includes("debrief.rule.upright"), "Г: «в полный рост» в разборе");
} catch (e) {
  ok(false, `ошибка: ${e.message.split("\n")[0]}`);
  await shot(page, "zz-error").catch(() => {});
} finally {
  // teacher_stop.mp3 нет в репозитории с самого начала: звук уходит на запасной.
  const uniq = [...new Set(errors)].filter((e) => !e.includes("404 (Not Found)"));
  ok(uniq.length === 0, `ошибок страницы/404 нет${uniq.length ? ": " + uniq.slice(0, 4).join(" | ") : ""}`);
  await browser.close();
  console.log(failures ? `\nПРОВАЛОВ: ${failures}` : "\nВСЁ ОК");
}
