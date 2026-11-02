import { test, expect } from '@playwright/test';
import { PAGES, SCHEMES, assertScheme } from './helpers.mjs';

// PR 3 palette: the accent sits on the places DESIGN.md lists, beyond links, the pull-quote rule
// and the focus ring. Labels and dates that are not listed stay muted.
const ACCENT_TEXT = ['.sec-h', '.stack dt', '.toolbox dt', '.tag', '.flow .n', '.pullquote span'];
const MUTED_TEXT = ['.job .dates', '.meta', '.note'];

async function usage(page) {
  return page.evaluate(({ accentText, mutedText }) => {
    // A token's computed value, read through a throwaway element's colour property.
    const probe = (name, prop = 'color') => {
      const el = document.createElement('span');
      el.style[prop] = `var(${name})`;
      document.body.append(el);
      const value = getComputedStyle(el)[prop];
      el.remove();
      return value;
    };
    const tokens = { accent: probe('--accent'), muted: probe('--muted'), surface: probe('--surface', 'backgroundColor') };
    const colours = (selectors) => selectors.flatMap((s) =>
      [...document.querySelectorAll(s)].map((node) => [s, getComputedStyle(node).color]));
    const tags = [...document.querySelectorAll('.tag')].map((node) => {
      const style = getComputedStyle(node);
      return [style.borderTopColor, style.backgroundColor];
    });
    return { tokens, accent: colours(accentText), muted: colours(mutedText), tags };
  }, { accentText: ACCENT_TEXT, mutedText: MUTED_TEXT });
}

for (const scheme of SCHEMES) {
  test(`accent and muted sit where DESIGN.md says in ${scheme} mode`, async ({ page }) => {
    const found = { accent: [], muted: [], tags: [] };
    let tokens;
    for (const { url } of PAGES) {
      await page.goto(url);
      await assertScheme(page, scheme);
      const result = await usage(page);
      tokens = result.tokens;
      found.accent.push(...result.accent);
      found.muted.push(...result.muted);
      found.tags.push(...result.tags);
    }
    // Every listed selector exists on some page, so a renamed class cannot pass silently.
    expect(new Set(found.accent.map(([s]) => s))).toEqual(new Set(ACCENT_TEXT));
    expect(new Set(found.muted.map(([s]) => s))).toEqual(new Set(MUTED_TEXT));
    for (const [selector, colour] of found.accent) expect(`${selector} ${colour}`).toBe(`${selector} ${tokens.accent}`);
    for (const [selector, colour] of found.muted) expect(`${selector} ${colour}`).toBe(`${selector} ${tokens.muted}`);
    for (const tag of found.tags) expect(tag).toEqual([tokens.accent, tokens.surface]);
  });
}
