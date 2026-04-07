import { describe, expect, test } from 'vitest';

import { formatEnumLabel, resolveLocale } from '../src/lib/i18n.js';

describe('i18n helpers', () => {
  test('uses browser zh locale when a preferred browser language is Chinese and falls back to English otherwise', () => {
    expect(resolveLocale(['zh-CN', 'en-US'])).toBe('zh-CN');
    expect(resolveLocale(['fr-FR', 'en-US'])).toBe('en');
    expect(resolveLocale(undefined)).toBe('en');
  });

  test('translates shared enum labels for the console shell', () => {
    expect(formatEnumLabel('repair_preparation', 'zh-CN')).toBe('修复准备');
    expect(formatEnumLabel('high', 'zh-CN')).toBe('高');
    expect(formatEnumLabel('ready_to_patch', 'en')).toBe('Ready to patch');
  });
});