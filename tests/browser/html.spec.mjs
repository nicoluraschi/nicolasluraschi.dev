import { test, expect } from '@playwright/test';
import { FileSystemConfigLoader, HtmlValidate } from 'html-validate/node';
import path from 'node:path';
import { PAGES, ROOT } from './helpers.mjs';

// AC1. The same .htmlvalidate.json as `npm run check:html`, through the API so the fixtures can
// be asserted rule by rule. The file-system loader is what reads that file.
const htmlvalidate = new HtmlValidate(new FileSystemConfigLoader());

async function ruleIds(file) {
  const report = await htmlvalidate.validateFile(path.join(ROOT, file));
  return report.results.flatMap((result) => result.messages.map((message) => message.ruleId));
}

for (const { file } of PAGES) {
  test(`${file} has no html-validate errors`, async () => {
    expect(await ruleIds(file)).toEqual([]);
  });
}

test('an unclosed element is reported as close-order', async () => {
  expect(await ruleIds('tests/fixtures/html-unclosed.html')).toContain('close-order');
});

test('a duplicate id is reported as no-dup-id', async () => {
  expect(await ruleIds('tests/fixtures/html-dup-id.html')).toEqual(['no-dup-id']);
});
