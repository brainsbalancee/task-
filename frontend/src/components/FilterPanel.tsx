import { motion } from 'framer-motion';
import { useI18n } from '../i18n/LanguageProvider';
import type { FacetField, Filters } from '../api/types';
import type { TranslationKey } from '../i18n/translations';
import { MultiSelectFilter } from './MultiSelectFilter';
import { cx } from '../lib/format';

interface Props {
  filters: Filters;
  skillMatch: 'any' | 'all';
  onFilterChange: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  onSkillMatchChange: (mode: 'any' | 'all') => void;
  onReset: () => void;
  activeCount: number;
  /** The mobile sheet renders its own title bar, so the panel hides one. */
  showHeading?: boolean;
}

/** Facet filters, ordered by how often a recruiter reaches for them. */
const FACETS: { field: FacetField; key: keyof Filters; label: TranslationKey; open?: boolean }[] = [
  { field: 'skills', key: 'skill', label: 'filter.skills', open: true },
  { field: 'jobTitle', key: 'title', label: 'filter.jobTitle', open: true },
  { field: 'company', key: 'company', label: 'filter.company' },
  { field: 'industry', key: 'industry', label: 'filter.industry' },
  { field: 'country', key: 'country', label: 'filter.country' },
  { field: 'level', key: 'level', label: 'filter.level' },
  { field: 'degree', key: 'degree', label: 'filter.degree' },
  { field: 'school', key: 'school', label: 'filter.school' },
];

export function FilterPanel({
  filters,
  skillMatch,
  onFilterChange,
  onSkillMatchChange,
  onReset,
  activeCount,
  showHeading = true,
}: Props) {
  const { t, n } = useI18n();

  return (
    <motion.aside
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={cx(
        'rounded-2xl',
        showHeading ? 'glass p-4 lg:sticky lg:top-20' : 'p-0',
      )}
    >
      {showHeading && (
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-white">{t('search.filters')}</h3>
          {activeCount > 0 && (
            <button
              onClick={onReset}
              className="rounded-md px-2 py-1 text-[11px] font-medium text-slate-500 transition hover:bg-white/5 hover:text-accent-400"
            >
              {t('search.reset')}
            </button>
          )}
        </div>
      )}

      {/* Skills AND/OR switch — only meaningful with 2+ skills selected. */}
      {filters.skill.length > 1 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-3 overflow-hidden"
        >
          <div className="rounded-xl border border-white/8 bg-ink-950/50 p-2">
            <div className="flex rounded-lg bg-ink-950/70 p-0.5">
              {(['any', 'all'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => onSkillMatchChange(mode)}
                  className={cx(
                    'flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition',
                    skillMatch === mode
                      ? 'bg-accent-500/25 text-accent-400'
                      : 'text-slate-500 hover:text-slate-300',
                  )}
                >
                  {t(mode === 'any' ? 'filter.skillMatch.any' : 'filter.skillMatch.all')}
                </button>
              ))}
            </div>
            <p className="mt-1.5 px-1 text-[10px] leading-snug text-slate-600">
              {t('filter.skillMatch.hint')}
            </p>
          </div>
        </motion.div>
      )}

      <div>
        {FACETS.map((facet) => (
          <MultiSelectFilter
            key={facet.field}
            field={facet.field}
            labelKey={facet.label}
            defaultOpen={facet.open}
            selected={filters[facet.key] as string[]}
            onChange={(values) => onFilterChange(facet.key, values as Filters[typeof facet.key])}
          />
        ))}

        {/* Numeric range — the one filter that is not a facet. */}
        <div className="pt-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-semibold text-slate-200">{t('filter.experience')}</span>
            {(filters.minExp || filters.maxExp) && (
              <button
                onClick={() => {
                  onFilterChange('minExp', '');
                  onFilterChange('maxExp', '');
                }}
                className="text-[11px] text-slate-500 transition hover:text-accent-400"
              >
                {t('filter.clear')}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {(['minExp', 'maxExp'] as const).map((key) => (
              <input
                key={key}
                type="number"
                min={0}
                max={60}
                inputMode="numeric"
                value={filters[key]}
                onChange={(event) => onFilterChange(key, event.target.value)}
                placeholder={t(key === 'minExp' ? 'filter.min' : 'filter.max')}
                className="w-full rounded-lg border border-white/8 bg-ink-950/60 px-2.5 py-2 text-xs tabular-nums text-slate-200 placeholder:text-slate-600 focus:border-accent-400/40 focus:outline-none"
              />
            ))}
          </div>
        </div>
      </div>

      {activeCount > 0 && (
        <p className="mt-4 rounded-lg bg-accent-500/10 px-3 py-2 text-center text-[11px] font-medium text-accent-400">
          {t('search.activeFilters', { count: n(activeCount) })}
        </p>
      )}
    </motion.aside>
  );
}
