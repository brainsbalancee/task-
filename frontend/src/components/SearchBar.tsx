import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { Suggestion } from '../api/types';
import { useDebounced } from '../hooks/useDebounced';
import { useI18n } from '../i18n/LanguageProvider';
import type { TranslationKey } from '../i18n/translations';
import { BriefcaseIcon, CloseIcon, PinIcon, SearchIcon, SparkIcon } from './Icons';
import { cx, titleCase } from '../lib/format';

interface Props {
  value: string;
  onChange: (value: string) => void;
  loading: boolean;
  /** Selecting a skill suggestion applies it as a filter instead of as text. */
  onPickSkill: (skill: string) => void;
}

const TYPE_META: Record<Suggestion['type'], { labelKey: TranslationKey; icon: typeof SparkIcon; tint: string }> = {
  skill: { labelKey: 'suggest.skill', icon: SparkIcon, tint: 'text-accent-400' },
  title: { labelKey: 'suggest.title', icon: BriefcaseIcon, tint: 'text-violet-400' },
  company: { labelKey: 'suggest.company', icon: BriefcaseIcon, tint: 'text-mint-400' },
  name: { labelKey: 'suggest.name', icon: PinIcon, tint: 'text-amber-400' },
};

/**
 * The keyword input, with a type-ahead dropdown fed by `GET /api/suggest`.
 *
 * The value is controlled by the parent and debounced downstream, so typing
 * stays instant while requests are throttled. `dir="auto"` lets the browser
 * pick per-character direction — a Latin query typed in the Persian UI still
 * renders left-to-right.
 */
export function SearchBar({ value, onChange, loading, onPickSkill }: Props) {
  const { t, n } = useI18n();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const debounced = useDebounced(value, 180);

  // Fetch suggestions for the current term.
  useEffect(() => {
    const term = debounced.trim();
    if (term.length < 2) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    api
      .suggest(term, 8, controller.signal)
      .then((response) => {
        setSuggestions(response.data);
        setActive(-1);
      })
      .catch((err: Error) => {
        if (err.name !== 'AbortError') setSuggestions([]);
      });
    return () => controller.abort();
  }, [debounced]);

  // A click outside dismisses the dropdown.
  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const choose = (suggestion: Suggestion) => {
    // A skill is a filter, not a phrase — applying it directly is what the user
    // means, and it keeps the keyword box free for something else.
    if (suggestion.type === 'skill') {
      onPickSkill(suggestion.value);
      onChange('');
    } else {
      onChange(suggestion.value);
    }
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault();
      choose(suggestions[active]!);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  const showDropdown = open && suggestions.length > 0;

  return (
    <div ref={rootRef} className="relative">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="group relative"
      >
        {/* Gradient ring that lights up on focus. */}
        <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-r from-accent-500/0 via-accent-500/0 to-violet-500/0 opacity-0 blur transition duration-500 group-focus-within:from-accent-500/40 group-focus-within:via-violet-500/30 group-focus-within:to-mint-400/30 group-focus-within:opacity-100" />

        <div className="glass-strong relative flex items-center gap-3 rounded-2xl px-4 py-1 transition focus-within:border-accent-400/40">
          <SearchIcon
            className={cx(
              'h-5 w-5 shrink-0 transition',
              loading ? 'animate-pulse text-accent-400' : 'text-slate-500',
            )}
          />
          <input
            type="search"
            dir="auto"
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={t('search.placeholder')}
            aria-label={t('search.heading')}
            aria-expanded={showDropdown}
            aria-autocomplete="list"
            role="combobox"
            className="min-w-0 flex-1 bg-transparent py-3.5 text-[15px] text-white placeholder:text-slate-500 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {value && (
            <button
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              aria-label={t('search.clear')}
              className="shrink-0 rounded-lg p-2 text-slate-500 transition hover:bg-white/10 hover:text-white"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {showDropdown && (
          <motion.ul
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            role="listbox"
            className="glass-strong absolute inset-x-0 top-full z-40 mt-2 max-h-80 overflow-y-auto rounded-xl p-1.5 shadow-2xl shadow-black/50"
          >
            {suggestions.map((suggestion, i) => {
              const meta = TYPE_META[suggestion.type];
              const Icon = meta.icon;
              return (
                <li key={`${suggestion.type}-${suggestion.value}`} role="option" aria-selected={i === active}>
                  <button
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(suggestion)}
                    className={cx(
                      'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start transition',
                      i === active ? 'bg-white/10' : 'hover:bg-white/6',
                    )}
                  >
                    <Icon className={cx('h-3.5 w-3.5 shrink-0', meta.tint)} />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-slate-200">
                      {titleCase(suggestion.value)}
                    </span>
                    <span className="shrink-0 text-[10px] text-slate-600">{t(meta.labelKey)}</span>
                    {suggestion.count > 1 && (
                      <span className="shrink-0 rounded bg-white/6 px-1.5 py-0.5 text-[10px] tabular-nums text-slate-500">
                        {n(suggestion.count)}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>

      <p className="mt-2 px-1 text-xs text-slate-600">{t('search.hint')}</p>
    </div>
  );
}
