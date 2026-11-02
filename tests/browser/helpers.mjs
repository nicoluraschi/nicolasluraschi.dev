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
export const BACKGROUNDS = { light: 'rgb(246, 241, 235)', dark: 'rgb(21, 17, 14)' };

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

// Layout shift while Fraunces swaps in late: the woff2 is held until the page has painted in the
// fallback, then released. Only shifts after the release count, so the score is the swap's alone.
export const FONT_URL = '**/fonts/fraunces-latin.woff2';

export async function fontSwapShiftFailures(page, url, budget) {
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  await page.route(FONT_URL, async (route) => { await held; await route.continue(); });
  await page.addInitScript(() => {
    window.__swapShift = { counting: false, total: 0, sources: [] };
    new PerformanceObserver((list) => {
      const state = window.__swapShift;
      for (const entry of list.getEntries()) {
        if (!state.counting || entry.hadRecentInput) continue;
        state.total += entry.value;
        for (const { node } of entry.sources) {
          if (node) state.sources.push(node.nodeType === 3 ? '#text' : node.tagName.toLowerCase() + [...node.classList].map((c) => `.${c}`).join(''));
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  // Past swap's block period (at most 100 ms), so the fallback is on screen as a reader sees it,
  // and two frames, so shifts from the first layout are reported before counting starts.
  const frames = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(150);
  await frames();
  if (await page.evaluate(() => document.fonts.check('16px Fraunces'))) return ['Fraunces loaded before it was released'];
  await page.evaluate(() => { window.__swapShift.counting = true; });
  release();
  await page.evaluate(() => document.fonts.ready);
  await frames();
  const { total, sources } = await page.evaluate(() => window.__swapShift);
  return total <= budget ? [] : [`layout shift ${total.toFixed(4)} > ${budget} (moved: ${[...new Set(sources)].join(', ')})`];
}

// The external-link marker (an inline-block ::after) must sit on the line of the link's last
// character. A marker that wraps alone opens a new line box, so the link's last client rect
// starts a line below that character. Tops are compared, not top against bottom: in a tight
// heading the glyph box is taller than the line, so consecutive lines' boxes overlap.
export async function markerWrapFailures(page) {
  await page.evaluate(() => document.fonts.ready);
  return page.locator('a[href^="https:"]').evaluateAll((links) => links.flatMap((link) => {
    const texts = [];
    const walker = document.createTreeWalker(link, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) if (walker.currentNode.textContent.trim()) texts.push(walker.currentNode);
    const last = texts.at(-1);
    const end = last.textContent.trimEnd().length;
    const range = document.createRange();
    range.setStart(last, end - 1);
    range.setEnd(last, end);
    const char = range.getBoundingClientRect();
    const rects = link.getClientRects();
    const marker = rects[rects.length - 1];
    return marker.top > char.top + char.height / 2
      ? [`"${link.textContent.trim()}": marker on a line below the text (top ${marker.top} vs ${char.top})`]
      : [];
  }));
}

// Each project screenshot links to its own full-size PNG, as one box: the image's. An inline link
// around the block image is split into empty line fragments, and Chromium paints its focus ring on
// those, so the computed outline looks right while nothing shows. A page with no screenshot fails:
// the check can't pass by finding nothing.
export async function shotLinkFailures(page) {
  const shots = await page.locator('.shot img').evaluateAll((imgs) => imgs.map((img) => {
    const link = img.closest('a');
    const box = (r) => [r.left, r.top, r.width, r.height];
    return {
      src: img.src,
      href: link?.href ?? null,
      img: box(img.getBoundingClientRect()),
      rects: link ? [...link.getClientRects()].map(box) : [],
    };
  }));
  if (shots.length === 0) return ['no .shot img on the page'];
  return shots.flatMap(({ src, href, img, rects }) => {
    const name = src.split('/').pop();
    if (href === null) return [`${name}: not inside a link`];
    if (href !== src) return [`${name}: links to ${href}, not to its own PNG`];
    const one = rects.length === 1 && rects[0].every((v, i) => Math.abs(v - img[i]) <= 1);
    return one ? [] : [`${name}: link is ${rects.length} boxes, not the image's one`];
  });
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

// WCAG contrast from computed colours. rgb()/rgba() is what Chromium returns for hex tokens;
// anything else is reported, never guessed.
function parseRgb(value) {
  const m = value.match(/^rgba?\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\s*\)$/);
  return m ? { rgb: [+m[1], +m[2], +m[3]], alpha: m[4] === undefined ? 1 : +m[4] } : null;
}

function luminance([r, g, b]) {
  const lin = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// The first opaque background in the chain (nearest first), skipping transparent ones. Every
// token is opaque, so a translucent or unparsable layer returns null: reported, never guessed.
function effectiveBackground(chain) {
  for (const value of chain) {
    const colour = parseRgb(value);
    if (!colour || (colour.alpha > 0 && colour.alpha < 1)) return null;
    if (colour.alpha === 1) return colour.rgb;
  }
  return null;
}

// Every visible element with its own text, and every list marker, against the background behind
// it: 4.5:1, or 3:1 for large text (24px, or 18.66px at weight 700 or more).
export async function contrastFailures(page) {
  await page.evaluate(() => document.fonts.ready);
  const samples = await page.evaluate(() => {
    // The background-color of an element and each ancestor, nearest first.
    const chain = (el) => {
      const out = [];
      for (let n = el; n; n = n.parentElement) out.push(getComputedStyle(n).backgroundColor);
      return out;
    };
    // Opacity multiplies down the tree, so a faded ancestor fades this element's text too.
    const opacity = (el) => {
      let value = 1;
      for (let n = el; n; n = n.parentElement) value *= parseFloat(getComputedStyle(n).opacity);
      return value;
    };
    const label = (el) => el.tagName.toLowerCase() + [...el.classList].map((c) => `.${c}`).join('');
    const out = [];
    for (const el of document.body.querySelectorAll('*')) {
      if (el.getClientRects().length === 0) continue;
      const style = getComputedStyle(el);
      const alpha = opacity(el);
      if (style.visibility === 'hidden' || alpha === 0) continue;
      const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
      const backgrounds = chain(el);
      const base = {
        label: label(el), size: parseFloat(style.fontSize), weight: parseInt(style.fontWeight, 10), backgrounds, alpha,
      };
      if (own) out.push({ ...base, text: own.slice(0, 30), color: style.color });
      if (style.display === 'list-item' && style.listStyleType !== 'none') {
        out.push({ ...base, text: '::marker', color: getComputedStyle(el, '::marker').color });
      }
    }
    return out;
  });
  const failures = [];
  for (const sample of samples) {
    const where = `${sample.label} "${sample.text}"`;
    const fg = parseRgb(sample.color);
    const bg = effectiveBackground(sample.backgrounds);
    if (!fg || fg.alpha !== 1 || !bg || sample.alpha !== 1) {
      const faded = sample.alpha === 1 ? '' : ` at opacity ${Number(sample.alpha.toFixed(2))}`;
      failures.push(`${where}: cannot rate ${sample.color} on ${sample.backgrounds[0]}${faded}`);
      continue;
    }
    const large = sample.size >= 24 || (sample.size >= 18.66 && sample.weight >= 700);
    const needed = large ? 3 : 4.5;
    const ratio = contrastRatio(fg.rgb, bg);
    if (ratio < needed) failures.push(`${where}: ${ratio.toFixed(2)}:1, needs ${needed}:1`);
  }
  return failures;
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
      // The ring is drawn outside the element (outline-offset), over its parent's background.
      const ringBackgrounds = [];
      for (let n = el.parentElement; n; n = n.parentElement) ringBackgrounds.push(getComputedStyle(n).backgroundColor);
      return {
        ringBackgrounds,
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
    } else {
      const ring = parseRgb(focused.outlineColor);
      const behind = effectiveBackground(focused.ringBackgrounds);
      const ratio = ring && behind ? contrastRatio(ring.rgb, behind) : 0;
      if (ratio < 3) failures.push(`${label}: outline ${ratio.toFixed(2)}:1 against the background, needs 3:1`);
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
