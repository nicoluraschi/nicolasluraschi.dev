import { test, expect } from '@playwright/test';

// Home page structure that the copy relies on (PR 2: home content).
const STACK_LABELS = ['Backend', 'Frontend', 'Data & hosting', 'Quality', 'Operations', 'AI'];

const projects = (page) => page.locator('.work');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('sections run About, How I work with AI, Selected work, Experience, Toolbox, Contact', async ({ page }) => {
  const sections = await page.locator('main h2.sec-h').allTextContents();
  expect(sections.map((s) => s.trim())).toEqual(
    ['About', 'How I work with AI', 'Selected work', 'Experience', 'Toolbox', 'Contact']);
});

test('the hero body is a single lead paragraph', async ({ page }) => {
  await expect(page.locator('.hero-body p')).toHaveCount(1);
  await expect(page.locator('.hero-body p.lead')).toHaveCount(1);
});

test('the How I work with AI section links the essay', async ({ page }) => {
  const ai = page.getByRole('region', { name: 'How I work with AI' });
  await expect(ai.locator('a[href="/how-i-work"]')).toHaveCount(1);
});

test('selected work runs Marginalia, RunHub, then Winnow', async ({ page }) => {
  const titles = await projects(page).locator('h3').allTextContents();
  expect(titles.map((title) => title.trim().split(/\s/)[0])).toEqual(['Marginalia', 'RunHub', 'Winnow']);
});

test('Winnow is tagged in progress, with no link and no figure until it works', async ({ page }) => {
  const winnow = projects(page).filter({ has: page.locator('h3', { hasText: 'Winnow' }) });
  await expect(winnow.locator('h3 .tag')).toHaveText('in progress');
  await expect(winnow.locator('a')).toHaveCount(0);
  await expect(winnow.locator('figure')).toHaveCount(0);
});

test('Marginalia is tagged limited sign-up', async ({ page }) => {
  const marginalia = projects(page).filter({ has: page.locator('h3', { hasText: 'Marginalia' }) });
  await expect(marginalia.locator('h3 .tag')).toHaveText('limited sign-up');
});

test('each project has a labelled stack with known labels', async ({ page }) => {
  await expect(projects(page)).toHaveCount(3);
  for (const project of await projects(page).all()) {
    const labels = await project.locator('dl.stack dt').allTextContents();
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) expect(STACK_LABELS).toContain(label.trim());
  }
});

test('job headings are named by title only, with dates beside them', async ({ page }) => {
  const headings = page.locator('.job h3');
  await expect(headings).toHaveCount(3);
  for (const heading of await headings.all()) {
    await expect(heading).not.toHaveAccessibleName(/\d/);
  }
  await expect(page.locator('.job h3 .dates')).toHaveCount(0);
  await expect(page.locator('.job .dates')).toHaveCount(3);
});

test('experience runs newest first, starting with independent product work', async ({ page }) => {
  const headings = await page.locator('.job h3').allTextContents();
  expect(headings.map((h) => h.trim())).toEqual(
    ['Independent product work', 'Head of Technology', 'Software Engineer, junior to senior']);
});

test('an About section carries the languages line', async ({ page }) => {
  const about = page.getByRole('region', { name: 'About' });
  await expect(about).toContainText('Spanish (native) · English: professional working proficiency (B2)');
});
