// Dev-only: renders img/og.png (from scripts/_og-card.html; the underscore keeps GitHub Pages'
// Jekyll build from publishing it) and favicon.png (from favicon.svg)
// with the already-installed Playwright Chromium. Run after changing the card, the favicon or the
// tokens: `node scripts/render-assets.mjs`. Files are served from the repo by request
// interception, so no server or port is involved.
import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'http://render.invalid';
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

const JOBS = [
  { url: '/scripts/_og-card.html', out: 'img/og.png', width: 1200, height: 630, transparent: false },
  { url: '/favicon.svg', out: 'favicon.png', width: 32, height: 32, transparent: true },
];

const browser = await chromium.launch();
try {
  for (const job of JOBS) {
    const page = await browser.newPage({
      viewport: { width: job.width, height: job.height }, deviceScaleFactor: 1, colorScheme: 'light',
    });
    await page.route(`${ORIGIN}/**`, async (route) => {
      const file = path.join(ROOT, decodeURIComponent(new URL(route.request().url()).pathname));
      if (!file.startsWith(ROOT + path.sep)) return route.abort();
      try {
        await route.fulfill({ body: await readFile(file), contentType: TYPES[path.extname(file)] });
      } catch {
        await route.fulfill({ status: 404 });
      }
    });
    await page.goto(ORIGIN + job.url);
    await page.evaluate(() => document.fonts?.ready);
    await writeFile(path.join(ROOT, job.out), await page.screenshot({ omitBackground: job.transparent }));
    console.log(`${job.out}: ${job.width}x${job.height}`);
    await page.close();
  }
} finally {
  await browser.close();
}
