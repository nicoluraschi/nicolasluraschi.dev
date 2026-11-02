import { test, expect } from '@playwright/test';
import { PAGES, FONT_URL, fixtureUrl, fontSwapShiftFailures } from './helpers.mjs';

// Fraunces swaps in over a metric-adjusted fallback, so the page barely moves when it arrives.
// The budget is per page and width (layout-shift score; 0.1 is Core Web Vitals' "good").
const BUDGET = 0.02;

for (const width of [320, 360, 768, 1280]) {
  for (const { url } of PAGES) {
    test(`${url} moves at most ${BUDGET} when Fraunces swaps in at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      expect(await fontSwapShiftFailures(page, url, BUDGET)).toEqual([]);
    });
  }
}

// The tuned faces are local(): a misspelt name silently falls through to the untuned stack.
// Liberation Serif is the generic serif of Chromium on Linux (and CI), the platform tuned for.
test('the metric-adjusted fallback faces load on Linux', async ({ page }) => {
  test.skip(process.platform !== 'linux', 'Liberation Serif is the Linux fallback');
  await page.route(FONT_URL, () => {});
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const faces = await page.evaluate(async () => {
    const fallbacks = [...document.fonts].filter((f) => f.family !== 'Fraunces');
    await Promise.all(fallbacks.map((f) => f.load().catch(() => {})));
    return fallbacks.map((f) => `${f.family} ${f.weight} ${f.status}`);
  });
  expect(faces.length).toBeGreaterThan(0);
  expect(faces.filter((f) => !f.endsWith('loaded'))).toEqual([]);
});

test('a fallback far from Fraunces is reported', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const failures = await fontSwapShiftFailures(page, fixtureUrl('font-swap-shift.html'), BUDGET);
  expect(failures).toHaveLength(1);
  expect(failures[0]).toMatch(/^layout shift [\d.]+ > 0\.02/);
});
