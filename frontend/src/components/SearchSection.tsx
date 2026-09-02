import { AnimatePresence, motion } from 'framer-motion';
import { forwardRef, useEffect, useState } from 'react';
import { useSearch } from '../hooks/useSearch';
import { useSearchState } from '../hooks/useSearchState';
import { useI18n } from '../i18n/LanguageProvider';
import type { SortKey } from '../api/types';
import type { TranslationKey } from '../i18n/translations';
import { ExplainPanel } from './ExplainPanel';
import { FilterPanel } from './FilterPanel';
import { AlertIcon, CloseIcon, FilterIcon, SearchIcon } from './Icons';
import { Pagination } from './Pagination';
import { ProfileCard } from './ProfileCard';
import { ProfileDrawer } from './ProfileDrawer';
import { Reveal } from './Reveal';
import { SearchBar } from './SearchBar';

const SORT_OPTIONS: { value: SortKey; label: TranslationKey }[] = [
  { value: 'relevance', label: 'search.sort.relevance' },
  { value: 'experience_desc', label: 'search.sort.experience_desc' },
  { value: 'experience_asc', label: 'search.sort.experience_asc' },
  { value: 'connections_desc', label: 'search.sort.connections_desc' },
  { value: 'name_asc', label: 'search.sort.name_asc' },
];

/** The search application: input, filters, results, pagination, detail drawer. */
export const SearchSection = forwardRef<HTMLElement>((_props, ref) => {
  const { t, n } = useI18n();
  const state = useSearchState();
  const { items, meta, loading, error, retry } = useSearch(state.params);
  const [openProfileId, setOpenProfileId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const busy = loading || state.typing;

  // The mobile filter sheet is a modal: lock the page behind it.
  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSheetOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [sheetOpen]);

  const renderFilters = (showHeading: boolean) => (
    <FilterPanel
      filters={state.filters}
      skillMatch={state.skillMatch}
      onFilterChange={state.setFilter}
      onSkillMatchChange={state.setSkillMatch}
      onReset={state.reset}
      activeCount={state.activeFilterCount}
      showHeading={showHeading}
    />
  );

  return (
    <section ref={ref} id="search" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-12 sm:px-8 sm:py-14">
      <Reveal className="mb-5">
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {t('search.heading')}
        </h2>
      </Reveal>

      <SearchBar
        value={state.q}
        onChange={state.setQ}
        loading={busy}
        onPickSkill={state.toggleSkill}
      />

      <div className="mt-6 lg:grid lg:grid-cols-[266px_1fr] lg:gap-5">
        {/* Desktop filter rail. On small screens the same panel lives in a sheet. */}
        <div className="hidden lg:block">{renderFilters(true)}</div>

        <div className="min-w-0">
          {/* Toolbar: count, timing, filter trigger, sort */}
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            <button
              onClick={() => setSheetOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 lg:hidden"
            >
              <FilterIcon className="h-3.5 w-3.5" />
              {t('search.filters')}
              {state.activeFilterCount > 0 && (
                <span className="rounded-full bg-accent-500/25 px-1.5 py-0.5 text-[10px] font-bold text-accent-400 tabular-nums">
                  {n(state.activeFilterCount)}
                </span>
              )}
            </button>

            {/* On phones the count drops to its own full-width row below the
                controls; on desktop the three sit on one line. */}
            <div className="order-last w-full min-w-0 lg:order-2 lg:w-auto lg:flex-1">
              {meta ? (
                <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-sm font-semibold text-white tabular-nums">
                    {meta.total === 1
                      ? t('results.countOne')
                      : t('results.count', { total: n(meta.total) })}
                  </span>
                  <span className="whitespace-nowrap text-[11px] text-slate-600 tabular-nums">
                    {t('results.took', { ms: n(Math.round(meta.tookMs * 10) / 10) })}
                  </span>
                  <span className="hidden whitespace-nowrap text-[11px] text-slate-600 sm:inline">
                    · {t('results.engine', { engine: meta.engine })}
                  </span>
                </p>
              ) : (
                <span className="block h-5 w-32 animate-pulse rounded bg-white/6" />
              )}
            </div>

            <label className="ms-auto flex shrink-0 items-center gap-1.5 text-[11px] text-slate-500 lg:order-3">
              <span className="hidden sm:inline">{t('search.sort')}</span>
              <select
                value={state.sort}
                onChange={(event) => state.setSort(event.target.value as SortKey)}
                aria-label={t('search.sort')}
                className="rounded-lg border border-white/10 bg-ink-900 px-2 py-1.5 text-[11px] font-medium text-slate-200 focus:border-accent-400/40 focus:outline-none"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value} className="bg-ink-900">
                    {t(option.label)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {meta?.explain && !error && items.length > 0 && <ExplainPanel explain={meta.explain} />}

          {error ? (
            <StateCard
              icon={<AlertIcon className="h-6 w-6 text-rose-400" />}
              title={t('results.error.title')}
              body={t('results.error.body')}
              action={{ label: t('results.error.action'), onClick: retry }}
            />
          ) : !loading && items.length === 0 ? (
            <StateCard
              icon={<SearchIcon className="h-6 w-6 text-slate-500" />}
              title={t('results.empty.title')}
              body={t('results.empty.body')}
              action={{ label: t('results.empty.action'), onClick: state.resetAll }}
            />
          ) : (
            <>
              {/* Previous results stay visible (dimmed) while the next page loads. */}
              <motion.div
                animate={{ opacity: busy ? 0.45 : 1 }}
                transition={{ duration: 0.18 }}
                className="space-y-3"
              >
                {/* Default (sync) mode: `popLayout` measures children through a
                    ref, which a function component cannot receive. */}
                <AnimatePresence initial={false}>
                  {items.map((profile, index) => (
                    <ProfileCard
                      key={profile.id}
                      profile={profile}
                      index={index}
                      onOpen={setOpenProfileId}
                      activeSkills={state.filters.skill}
                      onSkillClick={state.toggleSkill}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>

              {meta && (
                <Pagination
                  page={meta.page}
                  pages={meta.pages}
                  onChange={(page) => {
                    state.setPage(page);
                    document
                      .getElementById('search')
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile filter sheet */}
      <AnimatePresence>
        {sheetOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSheetOpen(false)}
              className="fixed inset-0 z-60 bg-ink-950/70 backdrop-blur-sm lg:hidden"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={t('filters.sheet')}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 34, stiffness: 340 }}
              className="glass-strong fixed inset-x-0 bottom-0 z-70 flex max-h-[88vh] flex-col rounded-t-2xl border-t border-white/10 lg:hidden"
            >
              {/* Drag affordance */}
              <div className="relative flex items-center gap-2 px-4 pb-2 pt-4">
                <span aria-hidden className="absolute inset-x-0 top-1.5 mx-auto h-1 w-10 rounded-full bg-white/20" />
                <h3 className="text-sm font-bold text-white">{t('filters.sheet')}</h3>
                {state.activeFilterCount > 0 && (
                  <button
                    onClick={state.reset}
                    className="rounded-md px-2 py-1 text-[11px] font-medium text-slate-500 transition hover:bg-white/5 hover:text-accent-400"
                  >
                    {t('search.reset')}
                  </button>
                )}
                <button
                  onClick={() => setSheetOpen(false)}
                  aria-label={t('profile.close')}
                  className="ms-auto rounded-lg p-2 text-slate-400 transition hover:bg-white/8 hover:text-white"
                >
                  <CloseIcon className="h-4.5 w-4.5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 pb-2">{renderFilters(false)}</div>

              <div className="border-t border-white/8 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <button
                  onClick={() => setSheetOpen(false)}
                  className="w-full rounded-xl bg-gradient-to-r from-accent-500 to-violet-500 py-3 text-sm font-semibold text-white"
                >
                  {t('filters.done')}
                  {meta ? ` · ${n(meta.total)}` : ''}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ProfileDrawer profileId={openProfileId} onClose={() => setOpenProfileId(null)} />
    </section>
  );
});

SearchSection.displayName = 'SearchSection';

function StateCard({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action: { label: string; onClick: () => void };
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass flex flex-col items-center rounded-2xl px-6 py-14 text-center"
    >
      <span className="grid h-12 w-12 place-items-center rounded-xl border border-white/10 bg-white/5">
        {icon}
      </span>
      <h3 className="mt-4 text-base font-semibold text-white">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-slate-500">{body}</p>
      <button
        onClick={action.onClick}
        className="mt-5 rounded-lg bg-white/8 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/14 hover:text-white"
      >
        {action.label}
      </button>
    </motion.div>
  );
}
