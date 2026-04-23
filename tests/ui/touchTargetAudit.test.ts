import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = join(dirname(__filename), '..', '..');
const CSS_PATH = join(REPO_ROOT, 'app', 'styles', 'global.css');

const MIN_TAP_TARGET_PX = 44;

interface Declaration {
  selector: string;
  minWidth: number | null;
  minHeight: number | null;
  width: number | null;
  height: number | null;
  padding: { top: number; right: number; bottom: number; left: number } | null;
  fontSize: number | null;
}

function parsePx(value: string): number | null {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)(px)?$/);
  if (!match) return null;
  return Number(match[1]);
}

function parsePadding(raw: string): Declaration['padding'] {
  const pieces = raw.trim().split(/\s+/).map(parsePx);
  if (pieces.some((value) => value === null)) return null;
  const [t = 0, r, b, l] = pieces as number[];
  return {
    top: t,
    right: r ?? t,
    bottom: b ?? t,
    left: l ?? r ?? t,
  };
}

function declarationFor(selector: string, block: string): Declaration {
  const decl: Declaration = {
    selector,
    minWidth: null,
    minHeight: null,
    width: null,
    height: null,
    padding: null,
    fontSize: null,
  };
  const props = block.match(/([-\w]+)\s*:\s*([^;]+);/g) ?? [];
  for (const prop of props) {
    const match = prop.match(/([-\w]+)\s*:\s*([^;]+);/);
    if (!match) continue;
    const [, name, value] = match;
    switch (name.trim()) {
      case 'min-width':
        decl.minWidth = parsePx(value);
        break;
      case 'min-height':
        decl.minHeight = parsePx(value);
        break;
      case 'width':
        decl.width = parsePx(value);
        break;
      case 'height':
        decl.height = parsePx(value);
        break;
      case 'padding':
        decl.padding = parsePadding(value);
        break;
      case 'font-size':
        decl.fontSize = parsePx(value);
        break;
    }
  }
  return decl;
}

function parseRules(css: string): Declaration[] {
  const rules: Declaration[] = [];
  let i = 0;
  while (i < css.length) {
    const braceIdx = css.indexOf('{', i);
    if (braceIdx === -1) break;
    const selectorRaw = css.slice(i, braceIdx).trim();
    const bodyStart = braceIdx + 1;
    let bodyEnd = bodyStart;
    let depth = 1;
    while (bodyEnd < css.length && depth > 0) {
      if (css[bodyEnd] === '{') depth += 1;
      else if (css[bodyEnd] === '}') depth -= 1;
      if (depth === 0) break;
      bodyEnd += 1;
    }
    const body = css.slice(bodyStart, bodyEnd);

    if (selectorRaw && !selectorRaw.startsWith('@')) {
      for (const subSelector of selectorRaw.split(',')) {
        rules.push(declarationFor(subSelector.trim(), body));
      }
    }
    i = bodyEnd + 1;
  }
  return rules;
}

function effectiveHeight(decl: Declaration): number {
  if (decl.minHeight !== null) return decl.minHeight;
  if (decl.height !== null) return decl.height;
  const paddingY = (decl.padding?.top ?? 0) + (decl.padding?.bottom ?? 0);
  const fontHeight = decl.fontSize ?? 16;
  return paddingY + fontHeight;
}

function effectiveWidth(decl: Declaration): number {
  if (decl.minWidth !== null) return decl.minWidth;
  if (decl.width !== null) return decl.width;
  const paddingX = (decl.padding?.left ?? 0) + (decl.padding?.right ?? 0);
  const fontWidth = (decl.fontSize ?? 16) * 2;
  return paddingX + fontWidth;
}

// Primary mobile tap selectors. Hit target is satisfied if the **largest**
// effective dimension across any matching rule clears 44px — we accept that
// some desktop states are smaller, but at least one responsive variant has
// to carry the mobile size.
const MOBILE_TAP_SELECTORS = [
  '.side-button',
  '.tool-button',
  '.speed-row button',
  '.drawer-head button',
  '.save-row button',
  '.start-actions button',
];

describe('touch target audit (T09)', () => {
  const css = readFileSync(CSS_PATH, 'utf8');
  const rules = parseRules(css);

  it('every primary mobile tap selector has at least one declaration', () => {
    for (const selector of MOBILE_TAP_SELECTORS) {
      const matches = rules.filter((rule) => rule.selector === selector);
      expect(matches.length, `${selector} not found in global.css`).toBeGreaterThan(0);
    }
  });

  it('every primary mobile tap selector meets ≥44px effective hit height', () => {
    const failures: string[] = [];
    for (const selector of MOBILE_TAP_SELECTORS) {
      const matches = rules.filter((rule) => rule.selector === selector);
      const best = matches.reduce((max, rule) => {
        const h = effectiveHeight(rule);
        return h > max ? h : max;
      }, 0);
      if (best < MIN_TAP_TARGET_PX) {
        failures.push(`${selector} effective-height=${best}px (need ≥${MIN_TAP_TARGET_PX})`);
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  it('every primary mobile tap selector meets ≥44px effective hit width', () => {
    const failures: string[] = [];
    for (const selector of MOBILE_TAP_SELECTORS) {
      const matches = rules.filter((rule) => rule.selector === selector);
      const best = matches.reduce((max, rule) => {
        const w = effectiveWidth(rule);
        return w > max ? w : max;
      }, 0);
      if (best < MIN_TAP_TARGET_PX) {
        failures.push(`${selector} effective-width=${best}px (need ≥${MIN_TAP_TARGET_PX})`);
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });
});
