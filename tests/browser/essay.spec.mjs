import { test, expect } from '@playwright/test';

// PR 4: the essay layout. Wide screens get a 70rem page with a sticky contents column; narrow
// screens get one column with the contents list first. Prose keeps the reading measure while
// diagrams use the whole content column.
const REM = 16;
const PAGE_WIDTH = 70 * REM;
const MEASURE = 37 * REM;

const toc = (page) => page.getByRole('navigation', { name: 'Contents' });
const body = (page) => page.locator('.essay-body');

async function open(page, width) {
  await page.setViewportSize({ width, height: 800 });
  await page.goto('/how-i-work/');
  await page.evaluate(() => document.fonts.ready);
}

const box = async (locator) => locator.evaluate((el) => {
  const r = el.getBoundingClientRect();
  return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width };
});

test('at 1280px the page is 70rem wide with the contents beside the body', async ({ page }) => {
  await open(page, 1280);
  expect((await box(page.locator('main.essay'))).width).toBe(PAGE_WIDTH);
  const nav = await box(toc(page));
  const main = await box(body(page));
  expect(nav.right).toBeLessThanOrEqual(main.left);
  expect(main.width).toBeGreaterThan(MEASURE);
});

test('at 1280px the contents stay in view while the body scrolls', async ({ page }) => {
  await open(page, 1280);
  await expect(toc(page)).toHaveCSS('position', 'sticky');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const nav = await box(toc(page));
  expect(nav.top).toBeGreaterThanOrEqual(0);
  expect(nav.bottom).toBeLessThanOrEqual(800);
});

test('at 1280px prose keeps the measure and diagrams span the content column', async ({ page }) => {
  await open(page, 1280);
  const column = (await box(body(page))).width;
  const prose = await body(page).locator(':scope > section > :is(p, ul, ol):not(.diagram)').evaluateAll(
    (els) => els.map((el) => el.getBoundingClientRect().width));
  expect(prose.length).toBeGreaterThan(0);
  for (const width of prose) expect(width).toBeLessThanOrEqual(MEASURE);
  const diagrams = await body(page).locator('.diagram').evaluateAll(
    (els) => els.map((el) => el.getBoundingClientRect().width));
  expect(diagrams.length).toBeGreaterThan(0);
  for (const width of diagrams) expect(width).toBe(column);
});

test('at 1280px the flow cards in a row start at the same height', async ({ page }) => {
  await open(page, 1280);
  // Rows stretch to the tallest card; a card's title must not drift down inside the extra height.
  const offsets = await page.locator('.flow li').evaluateAll((els) => els.map((el) =>
    Math.round(el.querySelector('.t').getBoundingClientRect().top - el.getBoundingClientRect().top)));
  expect(offsets).toHaveLength(6);
  for (const offset of offsets) expect(offset).toBe(offsets[0]);
});

for (const width of [320, 360]) {
  test(`at ${width}px it is one column with the contents first`, async ({ page }) => {
    await open(page, width);
    const nav = await box(toc(page));
    const main = await box(body(page));
    expect(nav.bottom).toBeLessThanOrEqual(main.top);
    expect(nav.left).toBe(main.left);
    await expect(toc(page)).not.toHaveCSS('position', 'sticky');
  });
}

test('contents links name the sections in order and reach them', async ({ page }) => {
  await open(page, 1280);
  const links = toc(page).getByRole('link');
  const headings = body(page).locator('section > h2');
  const names = await links.allTextContents();
  expect(names.length).toBeGreaterThan(0);
  expect(names.map((n) => n.trim())).toEqual((await headings.allTextContents()).map((n) => n.trim()));
  for (const link of await links.all()) {
    const target = (await link.getAttribute('href')).slice(1);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`#${target}$`));
    const heading = page.locator(`[id="${target}"] > h2`);
    await expect(heading).toBeInViewport();
  }
});

test('the essay carries the four diagrams, and only the flow is hidden', async ({ page }) => {
  await open(page, 1280);
  const classes = await page.locator('.diagram').evaluateAll((els) => els.map((el) => el.classList[0]));
  expect(classes).toEqual(['roles', 'flow', 'risk', 'guards']);
  const hidden = await page.locator('[aria-hidden="true"]').evaluateAll((els) => els.map((el) => el.className));
  expect(hidden).toEqual(['flow diagram']);
});

test('the flow diagram and the numbered list under it name the same six steps', async ({ page }) => {
  await open(page, 1280);
  const steps = (await page.locator('.flow .t').allTextContents()).map((t) => t.trim());
  const list = (await page.locator('.flow + ol > li > strong').allTextContents()).map((t) => t.trim());
  expect(steps).toHaveLength(6);
  expect(steps).toEqual(list);
});

test('process by risk is a table of lanes against steps', async ({ page }) => {
  await open(page, 1280);
  const table = page.getByRole('table', { name: 'How much process each kind of change gets' });
  const lanes = await table.locator('thead th[scope="col"]').allTextContents();
  expect(lanes.map((l) => l.trim().split(/\s/)[0])).toEqual(['Trivial', 'Light', 'High-risk']);
  const steps = await table.locator('tbody th[scope="row"]').allTextContents();
  expect(steps.map((s) => s.trim())).toEqual(['Plan', 'Tests', 'Review', 'Second provider', 'Security']);
  await expect(table.locator('tbody tr td')).toHaveCount(15);
});

for (const width of [320, 360]) {
  test(`at ${width}px the risk table stacks each step with labelled lanes`, async ({ page }) => {
    await open(page, width);
    const cells = await page.locator('table.risk tbody td').evaluateAll((els) => {
      const table = els[0].closest('table').getBoundingClientRect().width;
      return els.map((el) => ({
        share: el.getBoundingClientRect().width / table,
        label: getComputedStyle(el, '::before').content,
      }));
    });
    expect(cells).toHaveLength(15);
    const lanes = ['Trivial', 'Light', 'High-risk'];
    cells.forEach((cell, i) => {
      // A cell spans its card (minus padding), not a quarter of the table.
      expect(cell.share).toBeGreaterThan(0.75);
      expect(cell.label).toContain(lanes[i % 3]);
    });
    // Stacking must not cost the table its semantics.
    await expect(page.getByRole('table', { name: 'How much process each kind of change gets' })).toBeVisible();
    await expect(page.getByRole('rowheader', { name: 'Security' })).toBeVisible();
  });
}

test('the pull-quote says a second provider reviews the risky work', async ({ page }) => {
  await open(page, 1280);
  await expect(page.locator('.pullquote')).toContainText('Codex reviews the risky work');
  await expect(page.locator('#flow')).toContainText('every blocking assumption');
});

test('headings run h1, then h2, with no level skipped', async ({ page }) => {
  await open(page, 1280);
  const levels = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll(
    (els) => els.map((el) => Number(el.tagName[1])));
  expect(levels[0]).toBe(1);
  expect(levels.filter((l) => l === 1)).toHaveLength(1);
  for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeLessThanOrEqual(levels[i - 1] + 1);
});
