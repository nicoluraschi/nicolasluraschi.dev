import { test, expect } from '@playwright/test';

// Home page structure that the copy relies on (PR 2: home content).
const STACK_LABELS = ['Backend', 'Frontend', 'Data & hosting', 'Quality', 'AI'];

// Selected work items other than the "How I work with AI" entry.
const projects = (page) => page.locator('.work').filter({ hasNot: page.locator('a[href="/how-i-work"]') });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('selected work runs Marginalia, RunHub, then Winnow', async ({ page }) => {
  const titles = await projects(page).locator('h3').allTextContents();
  expect(titles.map((title) => title.trim().split(/\s/)[0])).toEqual(['Marginalia', 'RunHub', 'Winnow']);
});

test('Winnow is tagged in progress, links its domain and has no figure', async ({ page }) => {
  const winnow = projects(page).filter({ has: page.locator('h3', { hasText: 'Winnow' }) });
  await expect(winnow.locator('h3 .tag')).toHaveText('in progress');
  await expect(winnow.locator('a')).toHaveCount(1);
  await expect(winnow.locator('h3 a')).toHaveAttribute('href', 'https://winnow.page');
  await expect(winnow.locator('figure')).toHaveCount(0);
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

test('an About section carries the languages line', async ({ page }) => {
  const about = page.getByRole('region', { name: 'About' });
  await expect(about).toContainText('Spanish (native) · English: professional working proficiency (B2)');
});
