import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'browser-tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
  projects: [
    { name: 'hmr', testMatch: ['sprite-fallback.spec.ts','panels.spec.ts','map.spec.ts','combat-aoe.spec.ts','skill-vfx-fallback.spec.ts'] },
    { name: 'production', testMatch: ['startup.spec.ts'] },
    { name: 'measurement', testMatch: ['measurements.spec.ts'] },
  ],
  webServer: undefined,
});
