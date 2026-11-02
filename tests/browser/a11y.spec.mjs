import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { PAGES, SCHEMES, assertScheme, fixtureUrl } from './helpers.mjs';

// AC4. The bar is WCAG 2.0, 2.1 and 2.2 A and AA; any violation fails.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function violationIds(page) {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return violations.map((violation) => violation.id);
}

test.use({ viewport: { width: 1280, height: 800 } });

for (const { url } of PAGES) {
  for (const scheme of SCHEMES) {
    test(`${url} has no axe violations in ${scheme} mode`, async ({ page }) => {
      await page.goto(url);
      await assertScheme(page, scheme);
      expect(await violationIds(page)).toEqual([]);
    });
  }
}

test('an image without alt is reported as image-alt', async ({ page }) => {
  await page.goto(fixtureUrl('axe-no-alt.html'));
  await assertScheme(page, 'light');
  expect(await violationIds(page)).toEqual(['image-alt']);
});

test('low-contrast text is reported as color-contrast', async ({ page }) => {
  await page.goto(fixtureUrl('axe-low-contrast.html'));
  await assertScheme(page, 'light');
  expect(await violationIds(page)).toEqual(['color-contrast']);
});
