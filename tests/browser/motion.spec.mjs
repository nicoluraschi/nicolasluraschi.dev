import { test, expect } from '@playwright/test';
import { PAGES, fixtureUrl, motionFailures } from './helpers.mjs';

// AC11. Reduced motion is honoured; the 'no-preference' arm proves the emulation applied.
for (const { url } of PAGES) {
  test(`${url} has no link transitions under reduced motion`, async ({ page }) => {
    await page.goto(url);
    expect(await motionFailures(page)).toEqual([]);
  });
}

test('an unconditional link transition fails under reduce', async ({ page }) => {
  await page.goto(fixtureUrl('motion-unconditional.html'));
  const failures = await motionFailures(page);
  expect(failures).toHaveLength(1);
  expect(failures[0]).toMatch(/reduce.*transition-duration/);
});
