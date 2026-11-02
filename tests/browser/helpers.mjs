import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// The two site pages, as URL paths and as files.
export const PAGES = [
  { url: '/', file: 'index.html' },
  { url: '/how-i-work/', file: 'how-i-work/index.html' },
];

export const SCHEMES = ['light', 'dark'];

// The literal --bg per scheme, so a failed colour-scheme emulation fails the test.
export const BACKGROUNDS = { light: 'rgb(244, 245, 245)', dark: 'rgb(12, 18, 21)' };

export const fixtureUrl = (name) => `/tests/fixtures/${name}`;

// Each check returns a list of failure descriptions; empty means the page passes. The site specs
// and the fixture specs call the same function, so a check that cannot fail is caught.
export async function horizontalOverflow(page) {
  // The webfont changes line breaks, so measure after it has loaded.
  await page.evaluate(() => document.fonts.ready);
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  return scrollWidth <= innerWidth ? [] : [`scrollWidth ${scrollWidth} > viewport ${innerWidth}`];
}

// Alpha of a computed CSS colour: "transparent" is 0; "... / a)" (rgb, color(), oklch(), lab())
// and the legacy 4-argument rgba()/hsla() carry it; a colour with no alpha is opaque (1).
export function colourAlpha(value) {
  const text = value.trim().toLowerCase();
  if (text === 'transparent') return 0;
  const parse = (part) => {
    const s = part.trim();
    return s.endsWith('%') ? parseFloat(s) / 100 : parseFloat(s);
  };
  const slash = text.match(/\/\s*([^)]+)\)\s*$/);
  if (slash) return parse(slash[1]);
  const legacy = text.match(/^(?:rgba|hsla)\(([^)]*)\)$/);
  if (legacy) {
    const parts = legacy[1].split(',');
    if (parts.length === 4) return parse(parts[3]);
  }
  return 1;
}

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

export async function focusFailures(page) {
  const count = await page.locator(FOCUSABLE).count();
  const failures = [];
  for (let step = 1; step <= count; step++) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      const style = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return {
        name: el.tagName.toLowerCase() + [...el.classList].map((c) => `.${c}`).join(''),
        text: (el.textContent || '').trim().slice(0, 30),
        isSkip: el.classList.contains('skip'),
        outlineStyle: style.outlineStyle,
        outlineWidth: parseFloat(style.outlineWidth),
        outlineColor: style.outlineColor,
        inViewport: box.top >= 0 && box.left >= 0
          && box.bottom <= window.innerHeight && box.right <= window.innerWidth,
      };
    });
    const label = `${focused.name} "${focused.text}"`;
    if (focused.outlineStyle === 'none' || focused.outlineWidth < 2) {
      failures.push(`${label}: outline ${focused.outlineStyle} ${focused.outlineWidth}px on focus`);
    }
    // Every design token is opaque, so anything less hides or weakens the ring.
    const alpha = colourAlpha(focused.outlineColor);
    if (alpha !== 1) {
      failures.push(`${label}: outline colour ${focused.outlineColor} is not opaque (alpha ${alpha})`);
    }
    if (step === 1 && !focused.isSkip) failures.push(`${label}: the skip link is not first`);
    if (step === 1 && !focused.inViewport) failures.push(`${label}: not inside the viewport while focused`);
  }
  return failures;
}

export async function tapTargetFailures(page) {
  const links = await page.locator('.site-header a, .links a').evaluateAll((els) =>
    els.map((el) => ({ text: el.textContent.trim(), height: el.getBoundingClientRect().height })));
  return links
    .filter((link) => link.height < 44)
    .map((link) => `"${link.text}" is ${link.height}px tall, needs 44px`);
}

export async function motionFailures(page) {
  const durations = () => page.locator('a').evaluateAll((els) =>
    els.map((el) => ({ text: el.textContent.trim().slice(0, 30), value: getComputedStyle(el).transitionDuration })));
  const failures = [];
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const { text, value } of await durations()) {
    if (value !== '0s') failures.push(`reduce: "${text}" has transition-duration ${value}`);
  }
  // Proves the emulation applied: the same page must transition when motion is allowed.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  if (!(await durations()).some(({ value }) => value !== '0s')) {
    failures.push('no-preference: no link has a transition-duration, so the emulation may not apply');
  }
  return failures;
}

// Emulate a colour scheme and prove it applied by reading the body's computed background.
export async function assertScheme(page, scheme) {
  await page.emulateMedia({ colorScheme: scheme });
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  if (background !== BACKGROUNDS[scheme]) {
    throw new Error(`${scheme} emulation did not apply: body background is ${background}`);
  }
}
