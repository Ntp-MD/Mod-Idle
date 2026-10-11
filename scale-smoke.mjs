import { chromium } from 'playwright';
const sizes = [[1280,720],[1920,1080],[2560,1440]];
const browser = await chromium.launch();
for (const [w,h] of sizes) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(1200);
  const gap = await page.evaluate(() => ({
    v: document.documentElement.scrollHeight - innerHeight,
    h: document.documentElement.scrollWidth - innerWidth,
    rail: getComputedStyle(document.querySelector('.rail')).width,
    hp: getComputedStyle(document.querySelector('.hp-bubble') ?? document.body).height,
  }));
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  const gap2 = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  await page.screenshot({ path: `tools/scale-${w}.png` });
  console.log(`${w}x${h}: gapV=${gap.v} gapH=${gap.h} afterEscape=${gap2} rail=${gap.rail} hp=${gap.hp} errs=${errs.length}`);
  await page.close();
}
await browser.close();
