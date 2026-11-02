import { test, expect } from '@playwright/test';
import { PAGES, SCHEMES, assertScheme, contrastFailures, fixtureUrl } from './helpers.mjs';

// PR 3 palette: every rendered text/background pair meets WCAG AA in both schemes, computed from
// the page itself rather than from the token list. Phone and desktop widths, as the type scale
// changes at the breakpoint.
for (const width of [320, 1280]) {
  for (const { url } of PAGES) {
    for (const scheme of SCHEMES) {
      test(`${url} text meets AA contrast in ${scheme} mode at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(url);
        await assertScheme(page, scheme);
        expect(await contrastFailures(page)).toEqual([]);
      });
    }
  }
}

test('pale body text is named with its ratio', async ({ page }) => {
  await page.goto(fixtureUrl('axe-low-contrast.html'));
  await assertScheme(page, 'light');
  const failures = await contrastFailures(page);
  expect(failures).toHaveLength(1);
  expect(failures[0]).toMatch(/^p\.faint .*: 2\.\d+:1, needs 4\.5:1$/);
});

test('translucent text, or text under a faded ancestor, is reported, not rated', async ({ page }) => {
  await page.goto(fixtureUrl('contrast-translucent.html'));
  await assertScheme(page, 'light');
  const failures = await contrastFailures(page);
  expect(failures).toHaveLength(2);
  expect(failures[0]).toMatch(/^p\.veil .*: cannot rate rgba\(0, 0, 0, 0\.5\)/);
  expect(failures[1]).toMatch(/^p "Defect: this section is faded.*: cannot rate .* at opacity 0\.6/);
});

test('large text passes at 3:1 where body text fails', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(fixtureUrl('contrast-large.html'));
  await assertScheme(page, 'light');
  const failures = await contrastFailures(page);
  expect(failures).toHaveLength(1);
  expect(failures[0]).toMatch(/^p\.mid .*needs 4\.5:1$/);
});
