import { test, expect } from '@playwright/test';
import { SCHEMES, assertScheme, fixtureUrl, shotLinkFailures } from './helpers.mjs';

// On a phone a 1280x800 screenshot shrinks past reading, so each one links to its full-size PNG.
for (const width of [320, 360, 768, 1280]) {
  for (const scheme of SCHEMES) {
    test(`/ links each screenshot to its full-size PNG at ${width}px in ${scheme} mode`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      await assertScheme(page, scheme);
      expect(await shotLinkFailures(page)).toEqual([]);
    });
  }
}

test('a page with no screenshot is reported, not passed', async ({ page }) => {
  await page.goto(fixtureUrl('marker-wrap.html'));
  expect(await shotLinkFailures(page)).toEqual(['no .shot img on the page']);
});

test('a screenshot with no link is reported', async ({ page }) => {
  await page.goto(fixtureUrl('shot-unlinked.html'));
  expect(await shotLinkFailures(page)).toEqual(['runhub.png: not inside a link']);
});

test('an inline screenshot link, whose focus ring does not paint, is reported', async ({ page }) => {
  await page.goto(fixtureUrl('shot-inline-link.html'));
  const failures = await shotLinkFailures(page);
  expect(failures).toHaveLength(1);
  expect(failures[0]).toMatch(/^runhub\.png: link is \d+ boxes, not the image's one$/);
});

test('a screenshot linked to another file is reported', async ({ page }) => {
  await page.goto(fixtureUrl('shot-wrong-target.html'));
  expect(await shotLinkFailures(page)).toEqual([
    `runhub.png: links to ${new URL('/img/marginalia.png', page.url()).href}, not to its own PNG`,
  ]);
});
