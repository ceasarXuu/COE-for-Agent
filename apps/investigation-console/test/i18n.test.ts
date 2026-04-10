import { describe, expect, test } from 'vitest';

import { formatEnumLabel, readStoredLocale, resolveInitialLocale, resolveLocale } from '../src/lib/i18n.js';

describe('i18n helpers', () => {
  test('uses browser zh locale when a preferred browser language is Chinese and falls back to English otherwise', () => {
    expect(resolveLocale(['zh-CN', 'en-US'])).toBe('zh-CN');
    expect(resolveLocale(['fr-FR', 'en-US'])).toBe('en');
    expect(resolveLocale(undefined)).toBe('en');
  });

  test('prefers a stored locale over browser locale and falls back when the stored locale is invalid', () => {
    expect(resolveInitialLocale({ storedLocale: 'en', preferred: ['zh-CN', 'en-US'] })).toBe('en');
    expect(resolveInitialLocale({ storedLocale: 'zh-CN', preferred: ['en-US'] })).toBe('zh-CN');
    expect(resolveInitialLocale({ storedLocale: 'fr-FR', preferred: ['zh-CN', 'en-US'] })).toBe('zh-CN');
  });

  test('reads only supported locales from storage', () => {
    expect(readStoredLocale({ getItem: () => 'zh-CN' })).toBe('zh-CN');
    expect(readStoredLocale({ getItem: () => 'en' })).toBe('en');
    expect(readStoredLocale({ getItem: () => 'fr-FR' })).toBeUndefined();
    expect(readStoredLocale({ getItem: () => null })).toBeUndefined();
  });

  test('translates shared enum labels for the console shell', () => {
    expect(formatEnumLabel('repair_preparation', 'zh-CN')).toBe('修复准备');
    expect(formatEnumLabel('discriminative_testing', 'zh-CN')).toBe('判别验证');
    expect(formatEnumLabel('high', 'zh-CN')).toBe('高');
    expect(formatEnumLabel('ready_to_patch', 'en')).toBe('Ready to patch');
  });
});
