import { chromium } from "playwright";
const shots = "/private/tmp/claude-501/-Users-dibsnva-Downloads-saq-emergency-simulator-main/413dd83d-4305-4d63-b2a2-8859b0dcedde/scratchpad";
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1400, height: 850 }, reducedMotion: "no-preference" });
const problems = [];
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
page.on("response", (r) => r.status() >= 400 && problems.push(`${r.status()} ${r.url().split("/").pop()}`));

await page.goto("http://127.0.0.1:3000/ru/quest/earthquake", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Начать квест/ }).click();
const rooms = [];
for (let step = 0; step < 80; step++) {
  const h1 = await page.locator("h1").innerText();
  if (/действуете уверенно|пробелы|разобрать заново/.test(h1)) break;
  const skip = page.getByRole("button", { name: /Пропустить/ });
  if (await skip.count()) {
    if (!rooms.includes(h1)) rooms.push(h1);
    const video = await page.evaluate(() => document.querySelector("video")?.src.split("/").pop() ?? "нет клипа");
    console.log(`${h1}: вступление — ${video}`);
    await skip.click();
    await page.waitForTimeout(300);
    continue;
  }
  const spots = page.locator("button[aria-pressed]");
  if (await spots.count()) {
    await spots.first().click();
    await page.waitForTimeout(900);
    const video = await page.evaluate(() => document.querySelector("video")?.src.split("/").pop() ?? "кадр");
    console.log(`   действие — ${video}`);
    continue;
  }
  const advance = page.getByRole("button", { name: /Дальше|Следующая комната|Показать итог/ });
  await advance.click();
  await page.waitForTimeout(500);
}
await page.waitForTimeout(500);
await page.screenshot({ path: `${shots}/fs-result.png`, fullPage: false });
console.log("комнат пройдено:", rooms.length);
console.log("итог:", await page.locator("h1").innerText());
console.log(problems.length ? "ПРОБЛЕМЫ:\n" + [...new Set(problems)].join("\n") : "проблем нет");
await browser.close();
