import { test, expect } from '@playwright/test';
import { PAGES, SCHEMES } from './helpers.mjs';

// PR 5 print stylesheet. 700px is about an A4 page inside its margins, so the phone-width rules
// would apply if the print rules did not override them.
test.use({ viewport: { width: 700, height: 1000 } });

async function printed(page) {
  return page.evaluate(() => {
    const style = (selector) => [...document.querySelectorAll(selector)].map((el) => getComputedStyle(el));
    const external = [...document.querySelectorAll('a[href^="https:"]')].map((a) => ({
      href: a.getAttribute('href'),
      after: getComputedStyle(a, '::after').content,
    }));
    const risk = document.querySelector('.risk');
    return {
      hidden: ['.skip', '.site-header', '.toc'].flatMap((s) => style(s).map((c) => [s, c.display])),
      body: [getComputedStyle(document.body).color, getComputedStyle(document.body).backgroundColor],
      linkColours: style('a').map((c) => c.color),
      external,
      unbroken: ['.job', '.work'].flatMap((s) => style(s).map((c) => [s, c.breakInside])),
      risk: risk && {
        table: getComputedStyle(risk).display,
        head: getComputedStyle(risk.querySelector('thead')).display,
      },
    };
  });
}

for (const scheme of SCHEMES) {
  test(`both pages print black on white without navigation in ${scheme} mode`, async ({ page }) => {
    const unbroken = new Set();
    for (const { url } of PAGES) {
      await page.goto(url);
      await page.emulateMedia({ media: 'print', colorScheme: scheme });
      const result = await printed(page);
      for (const [selector, display] of result.hidden) expect(`${url} ${selector} ${display}`).toBe(`${url} ${selector} none`);
      expect(result.body).toEqual(['rgb(0, 0, 0)', 'rgb(255, 255, 255)']);
      for (const colour of result.linkColours) expect(colour).toBe('rgb(0, 0, 0)');
      for (const { href, after } of result.external) expect(after).toContain(href);
      for (const [selector, value] of result.unbroken) {
        unbroken.add(selector);
        expect(`${selector} ${value}`).toBe(`${selector} avoid`);
      }
      if (url === '/how-i-work/') {
        expect(result.hidden.map(([s]) => s)).toContain('.toc');
        expect(result.risk).toEqual({ table: 'table', head: 'table-header-group' });
      } else {
        expect(result.external.length).toBeGreaterThan(0);
      }
    }
    // A renamed class cannot pass silently.
    expect(unbroken).toEqual(new Set(['.job', '.work']));
  });
}

test('on screen the external-link marker stays an arrow', async ({ page }) => {
  await page.goto('/');
  const after = await page.locator('a[href^="https:"]').first().evaluate((a) => getComputedStyle(a, '::after').content);
  expect(after).not.toContain('https:');
});
