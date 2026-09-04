import { chromium } from "playwright";
const shots = "/private/tmp/claude-501/-Users-dibsnva-Downloads-saq-emergency-simulator-main/413dd83d-4305-4d63-b2a2-8859b0dcedde/scratchpad";
const browser = await chromium.launch({ channel: "chrome" });
for (const [name, vp] of [["wide", { width: 1512, height: 900 }], ["ultrawide", { width: 1920, height: 800 }], ["phone", { width: 844, height: 390 }]]) {
  const page = await browser.newPage({ viewport: vp, reducedMotion: "no-preference" });
  await page.goto("http://127.0.0.1:3000/ru/quest/earthquake", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Начать квест/ }).click();
  // Пропускаем вступление, чтобы попасть на вопрос с точками
  await page.getByRole("button", { name: /Пропустить/ }).click().catch(() => {});
  await page.waitForFunction(() => document.querySelectorAll("button[aria-pressed]").length === 2, null, { timeout: 15000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${shots}/fs-${name}.png` });
  const spots = await page.evaluate(() => [...document.querySelectorAll("button[aria-pressed]")].map(b => {
    const r = b.getBoundingClientRect();
    return { метка: b.getAttribute("aria-label"), x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), виден: r.top > 0 && r.left > 0 && r.right < innerWidth && r.bottom < innerHeight };
  }));
  console.log(name, vp.width + "×" + vp.height, JSON.stringify(spots));
  await page.close();
}
await browser.close();
