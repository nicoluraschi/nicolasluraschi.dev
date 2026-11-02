import { test, expect } from '@playwright/test';
import { PAGES, SCHEMES, assertScheme, fixtureUrl, markerWrapFailures } from './helpers.mjs';

// The ↗ after an external link stays on the line of the link's last word.
for (const width of [320, 360, 768, 1280]) {
  for (const { url } of PAGES) {
    for (const scheme of SCHEMES) {
      test(`${url} keeps each external-link marker beside its text at ${width}px in ${scheme} mode`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(url);
        await assertScheme(page, scheme);
        expect(await markerWrapFailures(page)).toEqual([]);
      });
    }
  }
}

test('a marker pushed onto its own line is reported', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(fixtureUrl('marker-wrap.html'));
  await assertScheme(page, 'light');
  const failures = await markerWrapFailures(page);
  expect(failures).toHaveLength(1);
  expect(failures[0]).toMatch(/^"example\.org": marker on a line below the text/);
});
