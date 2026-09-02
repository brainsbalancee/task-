import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { useFacets } from '../hooks/useFacets';
import { useI18n } from '../i18n/LanguageProvider';
import type { FacetField } from '../api/types';
import type { TranslationKey } from '../i18n/translations';
import { ChevronDown, SearchIcon } from './Icons';
import { cx, titleCase } from '../lib/format';

interface Props {
  field: FacetField;
  labelKey: TranslationKey;
  selected: string[];
  onChange: (values: string[]) => void;
  /** Open on first render — used for the two headline filters. */
  defaultOpen?: boolean;
}

/**
 * A collapsible, searchable, multi-select filter.
 *
 * Options and their counts come from `GET /api/facets`, filtered server-side by
 * whatever the user types — so the list stays usable for a field with 2,400
 * distinct values (skills) without shipping any of them to the client up front.
 */
export function MultiSelectFilter({ field, labelKey, selected, onChange, defaultOpen }: Props) {
  const { t, n } = useI18n();
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [term, setTerm] = useState('');
  const { values, loading } = useFacets(field, term, open);

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  return (
    <div className="border-b border-white/6 last:border-b-0">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 py-3 text-start"
      >
        <span className="flex items-center gap-2 text-[13px] font-semibold text-slate-200">
          {t(labelKey)}
          {selected.length > 0 && (
            <span className="rounded-full bg-accent-500/20 px-2 py-0.5 text-[10px] font-bold text-accent-400 tabular-nums">
              {n(selected.length)}
            </span>
          )}
        </span>
        <ChevronDown
          className={cx('h-4 w-4 shrink-0 text-slate-500 transition-transform duration-300', open && 'rotate-180')}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="pb-3">
              <div className="relative mb-2">
                <SearchIcon className="pointer-events-none absolute inset-y-0 start-2.5 my-auto h-3.5 w-3.5 text-slate-600" />
                <input
                  value={term}
                  dir="auto"
                  onChange={(event) => setTerm(event.target.value)}
                  placeholder={t('filter.search', { field: t(labelKey).toLowerCase() })}
                  className="w-full rounded-lg border border-white/8 bg-ink-950/60 py-2 ps-8 pe-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-accent-400/40 focus:outline-none"
                />
              </div>

              {/* Selected values stay pinned at the top even when filtered out. */}
              {selected.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {selected.map((value) => (
                    <button
                      key={value}
                      onClick={() => toggle(value)}
                      className="group inline-flex max-w-full items-center gap-1 rounded-md bg-accent-500/18 px-2 py-1 text-[11px] font-medium text-accent-400 transition hover:bg-accent-500/28"
                    >
                      <span className="truncate">{titleCase(value)}</span>
                      <span className="text-accent-400/60 transition group-hover:text-accent-400">×</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="max-h-52 space-y-0.5 overflow-y-auto pe-1">
                {loading && values.length === 0 && (
                  <div className="space-y-1.5 py-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="h-6 animate-pulse rounded-md bg-white/4" />
                    ))}
                  </div>
                )}

                {!loading && values.length === 0 && (
                  <p className="py-3 text-center text-xs text-slate-600">{t('filter.empty')}</p>
                )}

                {values.map((option) => {
                  const active = selected.includes(option.value);
                  return (
                    <label
                      key={option.value}
                      className={cx(
                        'flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-xs transition',
                        active ? 'bg-accent-500/12 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggle(option.value)}
                        className="h-3.5 w-3.5 shrink-0 rounded border-white/20 bg-transparent accent-sky-500"
                      />
                      <span className="min-w-0 flex-1 truncate" title={option.value}>
                        {titleCase(option.value)}
                      </span>
                      <span className="shrink-0 text-[10px] tabular-nums text-slate-600">
                        {n(option.count)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
