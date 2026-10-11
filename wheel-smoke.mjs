import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2560, height: 1440 } });
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', e => errs.push(String(e)));
await page.goto('http://localhost:5173/');
await page.waitForSelector('.menuring', { timeout: 15000 });
await page.waitForTimeout(800);
const r = await page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const box = (s) => { const e = q(s); if (!e) return null; const b = e.getBoundingClientRect(); return `${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}x${Math.round(b.height)}`; };
  return {
    wheel: box('.wheel'), bag: box('.w-bag'), skills: box('.w-skills'), sheet: box('.w-sheet'),
    sats: [box('.sat-map'), box('.sat-craft'), box('.sat-forge'), box('.sat-market')],
    bar: box('.actionbar'), plate: box('.self-plate'), chron: box('.controls .knob.chron'),
    gapV: document.documentElement.scrollHeight - innerHeight,
  };
});
console.log(JSON.stringify(r, null, 1));
await page.screenshot({ path: 'tools/wheel-2560.png' });
// field mode: leave map, click the skills wedge
await page.keyboard.press('Escape'); await page.waitForTimeout(400);
await page.click('.w-skills');
await page.waitForTimeout(500);
const opened = await page.evaluate(() => document.querySelector('.box')?.querySelector('h2')?.textContent || 'no panel');
console.log('skills wedge opens:', opened);
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
await page.screenshot({ path: 'tools/wheel-field.png' });
console.log('errs:', errs.length);
await browser.close();
