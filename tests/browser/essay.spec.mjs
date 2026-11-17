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

test('the essay carries the five diagrams, and only the flow is hidden', async ({ page }) => {
  await open(page, 1280);
  const classes = await page.locator('.diagram').evaluateAll((els) => els.map((el) => el.classList[0]));
  expect(classes).toEqual(['roles', 'flow', 'risk', 'loop', 'guards']);
  const hidden = await page.locator('[aria-hidden="true"]').evaluateAll((els) => els.map((el) => el.className));
  // The loop is read as a list; only its visual step numbers are hidden, so they aren't read twice.
  expect(hidden).toEqual(['flow diagram', 'n', 'n', 'n', 'n', 'n']);
  await expect(page.locator('.loop .n:not([aria-hidden="true"])')).toHaveCount(0);
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

// The rewrite against the real setup: each claim below is scoped to what the workflow does.
test('the cross-review loop is a readable list of steps with a two-round limit', async ({ page }) => {
  await open(page, 1280);
  const loop = page.locator('figure.loop');
  await expect(loop.locator('figcaption')).toContainText('at most two rounds');
  const steps = loop.locator('ol > li');
  await expect(steps).toHaveCount(5);
  await expect(loop.locator('ol > li .n')).toHaveText(['1', '2', '3', '4', '5']);
  await expect(steps.nth(2)).toContainText('accepted');
  await expect(steps.nth(2)).toContainText('rejected');
  await expect(steps.nth(3)).toContainText('no third');
});

test('who writes the code is stated per tier, and Codex needs consent', async ({ page }) => {
  await open(page, 1280);
  for (const id of ['#tools', '#who']) {
    await expect(page.locator(id)).toContainText('separate agent writes the code and the tests');
  }
  await expect(page.locator('#tools')).toContainText('allowed code to go to a second provider');
  // Every other Codex claim carries the same consent scope.
  const consent = /where I've allowed it/i;
  await expect(page.locator('#flow ol:not(.flow) > li').nth(3)).toContainText(consent);
  await expect(page.locator('table.risk tbody tr').nth(3).locator('td').nth(2)).toContainText(consent);
  await expect(page.locator('#second-opinion > p').first()).toContainText(consent);
});

test('the security and data checks claim no more than the setup does', async ({ page }) => {
  await open(page, 1280);
  const guardrails = page.locator('#guardrails');
  await expect(guardrails).toContainText('or I record an override');
  await expect(guardrails).toContainText('A migration gets a migration-safety review');
  await expect(guardrails).toContainText('a schema or constraint change, a data-integrity review');
});

test('the hooks list says what they actually stop', async ({ page }) => {
  await open(page, 1280);
  const guards = page.locator('figure.guards');
  await expect(guards).toContainText('caught before the turn can end');
  await expect(guards).toContainText('Ending a turn while a security audit is owed');
  await expect(guards).not.toContainText('including ones made through the shell');
});

test('the high-risk lane names every trigger and the review I launch', async ({ page }) => {
  await open(page, 1280);
  const head = page.locator('table.risk thead th').nth(2);
  await expect(head).toContainText('dependencies');
  await expect(head).toContainText('new subsystems');
  await expect(page.locator('table.risk tbody tr').nth(2).locator('td').nth(2)).toContainText('I launch');
});

test('guardrails and the improvement loop are described', async ({ page }) => {
  await open(page, 1280);
  const guardrails = page.locator('#guardrails');
  await expect(guardrails).toContainText('never the conversation');
  await expect(guardrails).toContainText('migration');
  await expect(guardrails).toContainText('new endpoint');
  const improves = page.locator('#improves');
  await expect(improves).toContainText('logs what it found');
  await expect(improves).toContainText('weekly study session');
});

test('headings run h1, then h2, with no level skipped', async ({ page }) => {
  await open(page, 1280);
  const levels = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll(
    (els) => els.map((el) => Number(el.tagName[1])));
  expect(levels[0]).toBe(1);
  expect(levels.filter((l) => l === 1)).toHaveLength(1);
  for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeLessThanOrEqual(levels[i - 1] + 1);
});
