import { test, expect } from '@playwright/test';
import { PAGES, SCHEMES, assertScheme, fixtureUrl, horizontalOverflow } from './helpers.mjs';

// AC7. 320 and 360px are the narrowest phones the design promises to fit.
for (const width of [320, 360]) {
  for (const { url } of PAGES) {
    for (const scheme of SCHEMES) {
      test(`${url} does not scroll sideways at ${width}px in ${scheme} mode`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(url);
        await assertScheme(page, scheme);
        expect(await horizontalOverflow(page)).toEqual([]);
      });
    }
  }
}

test('a 400px fixed element overflows a 320px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(fixtureUrl('overflow-wide.html'));
  await assertScheme(page, 'light');
  const failures = await horizontalOverflow(page);
  expect(failures).toHaveLength(1);
  expect(failures[0]).toMatch(/scrollWidth \d+ > viewport 320/);
});
