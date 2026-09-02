import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { dictionaries, type Language, type TranslationKey } from './translations';

/**
 * Language + direction context.
 *
 * Switching language does three things: swaps the dictionary, flips
 * `<html dir>` (which drives every RTL-aware style in the app), and changes how
 * numbers are rendered — Persian copy reads badly with Latin digits.
 */

interface I18nValue {
  lang: Language;
  dir: 'ltr' | 'rtl';
  isRtl: boolean;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  /** Translate, with optional `{placeholder}` interpolation. */
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  /** Locale-aware number, using Persian digits in Persian. */
  n: (value: number, options?: Intl.NumberFormatOptions) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

const STORAGE_KEY = 'task.lang';

/**
 * Resolution order: an explicit `?lang=` in the URL, then the stored choice,
 * then the browser's own preference. The URL comes first so a link can be
 * shared in a specific language regardless of the recipient's saved setting.
 */
function initialLanguage(): Language {
  if (typeof window === 'undefined') return 'en';

  const requested = new URLSearchParams(window.location.search).get('lang');
  if (requested === 'en' || requested === 'fa') return requested;

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'en' || stored === 'fa') return stored;

  return navigator.language?.toLowerCase().startsWith('fa') ? 'fa' : 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(initialLanguage);
  const dir = lang === 'fa' ? 'rtl' : 'ltr';

  // The document element is the single source of truth for direction, so CSS
  // (`[dir='rtl']`, logical properties) and assistive tech stay in sync.
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    window.localStorage.setItem(STORAGE_KEY, lang);
  }, [lang, dir]);

  const setLang = useCallback((next: Language) => setLangState(next), []);
  const toggleLang = useCallback(
    () => setLangState((current) => (current === 'en' ? 'fa' : 'en')),
    [],
  );

  const t = useCallback<I18nValue['t']>(
    (key, vars) => {
      const template = dictionaries[lang][key] ?? dictionaries.en[key] ?? key;
      if (!vars) return template;
      return template.replace(/\{(\w+)\}/g, (match, name: string) =>
        name in vars ? String(vars[name]) : match,
      );
    },
    [lang],
  );

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(lang === 'fa' ? 'fa-IR' : 'en-US'),
    [lang],
  );

  const n = useCallback<I18nValue['n']>(
    (value, options) =>
      options
        ? new Intl.NumberFormat(lang === 'fa' ? 'fa-IR' : 'en-US', options).format(value)
        : numberFormatter.format(value),
    [lang, numberFormatter],
  );

  const value = useMemo<I18nValue>(
    () => ({ lang, dir, isRtl: dir === 'rtl', setLang, toggleLang, t, n }),
    [lang, dir, setLang, toggleLang, t, n],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside <LanguageProvider>');
  return context;
}
