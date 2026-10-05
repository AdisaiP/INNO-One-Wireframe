import { createContext, useContext, useEffect, useMemo, type PropsWithChildren } from 'react';
import enCommon from './locales/en-US/common.json';
import enNavigation from './locales/en-US/navigation.json';
import enFeedback from './locales/en-US/feedback.json';
import enProfile from './locales/en-US/profile.json';
import enAdmin from './locales/en-US/admin.json';
import enAssets from './locales/en-US/assets.json';
import enDevices from './locales/en-US/devices.json';
import enHelpdesk from './locales/en-US/helpdesk.json';
import enWorkflow from './locales/en-US/workflow.json';
import thCommon from './locales/th-TH/common.json';
import thNavigation from './locales/th-TH/navigation.json';
import thFeedback from './locales/th-TH/feedback.json';
import thProfile from './locales/th-TH/profile.json';
import thAdmin from './locales/th-TH/admin.json';
import thAssets from './locales/th-TH/assets.json';
import thDevices from './locales/th-TH/devices.json';
import thHelpdesk from './locales/th-TH/helpdesk.json';
import thWorkflow from './locales/th-TH/workflow.json';

export const SUPPORTED_LOCALES = ['en-US', 'th-TH'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export type TranslationParams = Record<string, string | number>;

type Catalog = Record<string, string>;

const catalogs: Record<Locale, Catalog> = {
  'en-US': {
    ...enCommon,
    ...enNavigation,
    ...enFeedback,
    ...enProfile,
    ...enAdmin,
    ...enAssets,
    ...enDevices,
    ...enHelpdesk,
    ...enWorkflow,
  },
  'th-TH': {
    ...thCommon,
    ...thNavigation,
    ...thFeedback,
    ...thProfile,
    ...thAdmin,
    ...thAssets,
    ...thDevices,
    ...thHelpdesk,
    ...thWorkflow,
  },
};

export function normalizeLocale(value?: string | null): Locale | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'th' || normalized.startsWith('th-')) return 'th-TH';
  if (normalized === 'en' || normalized.startsWith('en-')) return 'en-US';
  return null;
}

export function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en-US';
  for (const value of navigator.languages ?? [navigator.language]) {
    const locale = normalizeLocale(value);
    if (locale) return locale;
  }
  return 'en-US';
}

export function resolveLocale(
  preferred?: string | null,
  organizationDefault?: string | null,
  browserLocale?: string | null,
): Locale {
  return normalizeLocale(preferred)
    ?? normalizeLocale(organizationDefault)
    ?? normalizeLocale(browserLocale)
    ?? 'en-US';
}

export function translate(
  locale: Locale,
  key: string,
  params?: TranslationParams,
): string {
  const value = catalogs[locale][key] ?? catalogs['en-US'][key];
  if (!value) {
    if (typeof console !== 'undefined') {
      console.warn('[i18n] Missing translation key:', key, 'for', locale);
    }
    return key;
  }

  if (!params) return value;
  return value.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name: string) => {
    const replacement = params[name];
    return replacement === undefined ? match : String(replacement);
  });
}

export function formatDateTime(
  locale: Locale,
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
): string {
  const formatLocale = locale === 'th-TH' ? 'th-TH-u-ca-gregory-nu-latn' : 'en-US';
  return new Intl.DateTimeFormat(formatLocale, options).format(new Date(value));
}

export function formatNumber(
  locale: Locale,
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  const formatLocale = locale === 'th-TH' ? 'th-TH-u-ca-gregory-nu-latn' : 'en-US';
  return new Intl.NumberFormat(formatLocale, options).format(value);
}

export interface I18nContextValue {
  locale: Locale;
  t: (key: string, params?: TranslationParams) => string;
  formatDateTime: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  children,
}: PropsWithChildren<{ locale: Locale }>) {
  useEffect(() => {
    document.documentElement.lang = locale === 'th-TH' ? 'th' : 'en';
    document.documentElement.dir = 'ltr';
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    t: (key, params) => translate(locale, key, params),
    formatDateTime: (input, options) => formatDateTime(locale, input, options),
    formatNumber: (input, options) => formatNumber(locale, input, options),
  }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('I18nProvider is missing');
  return value;
}
