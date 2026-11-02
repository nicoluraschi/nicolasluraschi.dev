import { test, expect } from '@playwright/test';
import { PAGES, SCHEMES, assertScheme, fixtureUrl, focusFailures } from './helpers.mjs';

// AC9. Tab through every focusable element from the top of the page.
for (const { url } of PAGES) {
  for (const scheme of SCHEMES) {
    test(`${url} shows keyboard focus in ${scheme} mode`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(url);
      await assertScheme(page, scheme);
      expect(await focusFailures(page)).toEqual([]);
    });
  }
}

test('a transparent focus outline is named', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(fixtureUrl('focus-transparent.html'));
  await assertScheme(page, 'light');
  const failures = await focusFailures(page);
  expect(failures).toHaveLength(1);
  expect(failures[0]).toMatch(/a\.ghost.*not opaque/);
});

test('a nearly transparent focus outline is named', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(fixtureUrl('focus-translucent.html'));
  await assertScheme(page, 'light');
  const failures = await focusFailures(page);
  expect(failures).toHaveLength(1);
  expect(failures[0]).toMatch(/a\.faint.*not opaque/);
});

test('links that remove the outline on focus are named', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(fixtureUrl('focus-no-outline.html'));
  await assertScheme(page, 'light');
  const failures = await focusFailures(page);
  expect(failures.length).toBeGreaterThan(0);
  expect(failures.join('\n')).toMatch(/a\.plain.*outline/);
});
