import { test, expect } from '@playwright/test';

// Home layout details the copy exposed (home copy rewrite).
const box = (locator) => locator.evaluate((el) => {
  const r = el.getBoundingClientRect();
  return { top: r.top, bottom: r.bottom };
});

test('on phones the lead sits at least 16px below the location line', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/');
  const head = await box(page.locator('.hero-head'));
  const body = await box(page.locator('.hero-body'));
  expect(body.top - head.bottom).toBeGreaterThanOrEqual(16);
});

for (const width of [320, 1280]) {
  test(`at ${width}px an employer line after a job has a rule with space on both sides`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    const org = page.locator('.job + .org');
    await expect(org).toHaveCount(1);
    await expect(org).toHaveCSS('border-top-width', '1px');
    const space = await org.evaluate((el) => {
      const s = getComputedStyle(el);
      return { above: parseFloat(s.marginTop), below: parseFloat(s.paddingTop) };
    });
    expect(space.above).toBeGreaterThan(24);
    expect(space.below).toBeGreaterThan(0);
  });
}

for (const width of [320, 768, 1280]) {
  test(`at ${width}px each project's separator stays on the line of its link`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    const sites = page.locator('.work h3 .site');
    await expect(sites).toHaveCount(2);
    for (const site of await sites.all()) {
      await expect(site).toHaveText(/^· /);
      const lines = await site.evaluate((el) => new Set(
        [...el.getClientRects()].map((r) => Math.round(r.top))).size);
      expect(lines).toBe(1);
    }
  });
}
