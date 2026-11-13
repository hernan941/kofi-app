import { readFileSync } from 'fs';
import { join } from 'path';

import { findGuiltPattern } from '@/shared/lib/testing/guilt-patterns';

import { BUNDLED_TIPS, bundledTipCatalog } from './catalog';
import {
  TIP_BODY_MAX_LENGTH,
  TIP_CATEGORIES,
  TIP_TITLE_MAX_LENGTH,
  TIP_TRIGGERS,
  tipIdSchema,
  type Tip,
} from './tip';
import { parseTipsMarkdown } from './testing/parse-tips-markdown';

const MARKDOWN_PATH = join(process.cwd(), 'docs', 'content', 'consejos.md');

function countBy<Key>(tips: readonly Tip[], key: (tip: Tip) => Key, value: Key): number {
  return tips.filter((tip) => key(tip) === value).length;
}

describe('bundled tip catalog', () => {
  test('matches docs/content/consejos.md field by field and in the same order', () => {
    const fromMarkdown = parseTipsMarkdown(readFileSync(MARKDOWN_PATH, 'utf8'));
    expect(BUNDLED_TIPS).toEqual(fromMarkdown);
  });

  test('is exposed through the TipCatalog port', () => {
    expect(bundledTipCatalog.all()).toBe(BUNDLED_TIPS);
  });

  test('has between 20 and 30 tips', () => {
    expect(BUNDLED_TIPS.length).toBeGreaterThanOrEqual(20);
    expect(BUNDLED_TIPS.length).toBeLessThanOrEqual(30);
  });

  test('has unique kebab-case ids', () => {
    const ids = BUNDLED_TIPS.map((tip) => tip.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => tipIdSchema.safeParse(id).success)).toBe(true);
  });

  test('uses valid categories and at least 3 tips per category', () => {
    for (const category of TIP_CATEGORIES) {
      expect(countBy(BUNDLED_TIPS, (tip) => tip.category, category)).toBeGreaterThanOrEqual(3);
    }
    expect(BUNDLED_TIPS.every((tip) => TIP_CATEGORIES.includes(tip.category))).toBe(true);
  });

  test('respects the title and body limits and has no blank text', () => {
    for (const tip of BUNDLED_TIPS) {
      expect(tip.title.trim()).not.toBe('');
      expect(tip.body.trim()).not.toBe('');
      expect(tip.title.length).toBeLessThanOrEqual(TIP_TITLE_MAX_LENGTH);
      expect(tip.body.length).toBeLessThanOrEqual(TIP_BODY_MAX_LENGTH);
    }
  });

  test('no text matches a guilt pattern', () => {
    for (const tip of BUNDLED_TIPS) {
      expect(findGuiltPattern(tip.title)).toBeNull();
      expect(findGuiltPattern(tip.body)).toBeNull();
    }
  });

  test('every trigger has at least one tip and first_sale has exactly one', () => {
    for (const trigger of TIP_TRIGGERS) {
      expect(countBy(BUNDLED_TIPS, (tip) => tip.trigger, trigger)).toBeGreaterThanOrEqual(1);
    }
    expect(countBy(BUNDLED_TIPS, (tip) => tip.trigger, 'first_sale')).toBe(1);
  });

  test('example amounts use the dotted thousands format', () => {
    for (const tip of BUNDLED_TIPS) {
      expect(`${tip.title} ${tip.body}`).not.toMatch(/\$\d{4,}/);
    }
  });
});
