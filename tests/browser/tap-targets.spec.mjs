import { test, expect } from '@playwright/test';
import { PAGES, fixtureUrl, tapTargetFailures } from './helpers.mjs';

// AC10. Header and contact links keep 44px tap targets at the narrowest viewport.
for (const { url } of PAGES) {
  test(`${url} header and contact links are at least 44px tall at 320px`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(url);
    expect(await tapTargetFailures(page)).toEqual([]);
  });
}

test('a header link under 44px is named', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(fixtureUrl('tap-short-link.html'));
  const failures = await tapTargetFailures(page);
  expect(failures).toHaveLength(1);
  expect(failures[0]).toMatch(/Short link.*px/);
});
