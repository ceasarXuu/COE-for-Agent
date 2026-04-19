import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';

import { ENUM_LABELS, MESSAGES } from './i18n-catalog.js';

export type Locale = 'en' | 'zh-CN';
export const LOCALE_STORAGE_KEY = 'investigation-console.locale';

type MessageParams = Record<string, number | string>;

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: MessageParams) => string;
  formatDateTime: (value: Date | number | string) => string;
  formatEnumLabel: (value: null | string | undefined) => string;
  formatEventType: (value: null | string | undefined) => string;
  compareText: (left: string, right: string) => number;
}

const I18nContext = createContext<I18nValue>(createI18nValue('en'));

export function I18nProvider(props: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => props.initialLocale ?? resolveInitialLocale({
    storedLocale: readStoredLocale(getLocaleStorage()),
    preferred: getBrowserLanguages()
  }));

  const setLocale = (nextLocale: Locale) => {
    setLocaleState(nextLocale);
    persistLocale(nextLocale, getLocaleStorage());
  };
  const value = useMemo(() => createI18nValue(locale, setLocale), [locale]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  return <I18nContext.Provider value={value}>{props.children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

export function resolveLocale(preferred: readonly string[] | string | undefined): Locale {
  const candidates = Array.isArray(preferred)
    ? preferred
    : typeof preferred === 'string'
      ? [preferred]
      : [];

  return candidates.some((value) => value.toLowerCase().startsWith('zh')) ? 'zh-CN' : 'en';
}

export function readStoredLocale(
  storage: { getItem: (key: string) => null | string } | undefined
): Locale | undefined {
  if (!storage) {
    return undefined;
  }

  const value = storage.getItem(LOCALE_STORAGE_KEY);
  return isLocale(value) ? value : undefined;
}

export function resolveInitialLocale(options: {
  storedLocale?: Locale | null | string | undefined;
  preferred?: readonly string[] | string | undefined;
}): Locale {
  return isLocale(options.storedLocale) ? options.storedLocale : resolveLocale(options.preferred);
}

export function formatEnumLabel(value: null | string | undefined, locale: Locale): string {
  if (!value) {
    const unknownLabel = ENUM_LABELS[locale].unknown;
    return typeof unknownLabel === 'string' ? unknownLabel : 'Unknown';
  }

  const normalized = value.toLowerCase();
  return ENUM_LABELS[locale][normalized] ?? ENUM_LABELS.en[normalized] ?? humanizeEnum(value, locale);
}

function createI18nValue(locale: Locale, setLocale: (locale: Locale) => void = () => undefined): I18nValue {
  const languageTag = locale === 'zh-CN' ? 'zh-CN' : 'en-US';
  const collator = new Intl.Collator(languageTag, {
    numeric: true,
    sensitivity: 'base'
  });

  return {
    locale,
    setLocale,
    t: (key, params) => translate(locale, key, params),
    formatDateTime: (value) => {
      const date = value instanceof Date ? value : new Date(value);
      return new Intl.DateTimeFormat(languageTag, {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(date);
    },
    formatEnumLabel: (value) => formatEnumLabel(value, locale),
    formatEventType: (value) => formatEventType(value, locale),
    compareText: (left, right) => collator.compare(left, right)
  };
}

function translate(locale: Locale, key: string, params?: MessageParams): string {
  const template = MESSAGES[locale][key] ?? MESSAGES.en[key] ?? key;
  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_, paramName: string) => String(params[paramName] ?? ''));
}

function humanizeEnum(value: string, locale: Locale): string {
  const normalized = value.replace(/[_-]+/g, ' ').trim();
  if (locale === 'zh-CN') {
    return normalized;
  }

  return normalized.replace(/\b\w/g, (segment) => segment.toUpperCase());
}

export function formatEventType(value: null | string | undefined, locale: Locale): string {
  if (!value) {
    return formatEnumLabel(value, locale);
  }

  const key = `timeline.event.${value}`;
  const translated = MESSAGES[locale][key] ?? MESSAGES.en[key];
  if (translated) {
    return translated;
  }

  const normalized = value.replace(/[._-]+/g, ' ').trim();
  if (locale === 'zh-CN') {
    return normalized;
  }

  return normalized.replace(/\b\w/g, (segment) => segment.toUpperCase());
}

function getBrowserLanguages(): string[] | undefined {
  if (typeof navigator === 'undefined') {
    return undefined;
  }

  if (Array.isArray(navigator.languages) && navigator.languages.length > 0) {
    return navigator.languages;
  }

  return typeof navigator.language === 'string' ? [navigator.language] : undefined;
}

function getLocaleStorage(): Pick<Storage, 'getItem' | 'setItem'> | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function isLocale(value: null | string | undefined): value is Locale {
  return value === 'en' || value === 'zh-CN';
}

function persistLocale(locale: Locale, storage: { setItem: (key: string, value: string) => void } | undefined) {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    return;
  }
}