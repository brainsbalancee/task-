import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import type { SearchExplain } from '../api/types';
import { useI18n } from '../i18n/LanguageProvider';
import { ChevronDown, SparkIcon } from './Icons';
import { cx } from '../lib/format';

/**
 * Surfaces the backend's `?explain=1` trace next to the results.
 *
 * "Why is this profile first?" is the question a faceted search always raises
 * and almost never answers. This panel shows the parsed keyword expression, the
 * BM25 field weights, the exact filter predicates and the statement that ran —
 * the ranking is inspectable rather than something to take on trust.
 */
export function ExplainPanel({ explain }: { explain: SearchExplain }) {
  const { t, n } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className="glass mb-3 overflow-hidden rounded-xl">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 p-3 text-start transition hover:bg-white/4"
      >
        <SparkIcon className="h-3.5 w-3.5 shrink-0 text-accent-400" />
        <span className="flex-1 text-xs font-medium text-slate-300">
          {t(open ? 'explain.hide' : 'explain.show')}
        </span>
        <ChevronDown
          className={cx('h-4 w-4 shrink-0 text-slate-500 transition-transform', open && 'rotate-180')}
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
            <div className="space-y-3 border-t border-white/8 p-3">
              {explain.keyword ? (
                <Row label={t('explain.keyword')}>
                  <code dir="ltr" className="block text-start font-mono text-[11px] text-accent-400">
                    {explain.keyword.parsed ?? '—'}
                  </code>
                  <p className="mt-1 text-[11px] leading-snug text-slate-500">
                    {explain.keyword.note}
                  </p>
                </Row>
              ) : (
                <p className="text-[11px] text-slate-500">{t('explain.none')}</p>
              )}

              <Row label={t('explain.ranking')}>
                <code dir="ltr" className="block text-start font-mono text-[11px] text-mint-400">
                  {explain.ranking.function}
                </code>
                <p className="mt-1 text-[11px] leading-snug text-slate-500">{explain.ranking.note}</p>

                {explain.ranking.weights && (
                  <div className="mt-2 space-y-1">
                    {explain.ranking.weights.map((weight) => (
                      <div key={weight.field} className="flex items-center gap-2">
                        <span dir="ltr" className="w-20 shrink-0 text-start font-mono text-[10px] text-slate-500">
                          {weight.field}
                        </span>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/6">
                          <span
                            className="block h-full rounded-full bg-gradient-to-r from-accent-500 to-violet-500"
                            style={{ width: `${(weight.weight / 10) * 100}%` }}
                          />
                        </span>
                        <span className="w-6 shrink-0 text-end text-[10px] tabular-nums text-slate-500">
                          {n(weight.weight)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Row>

              {explain.filters.length > 0 && (
                <Row label={t('explain.filters')}>
                  <ul className="space-y-1.5">
                    {explain.filters.map((filter) => (
                      <li key={filter.field}>
                        <span dir="ltr" className="font-mono text-[11px] text-violet-400">
                          {filter.field}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {' = '}
                          {Array.isArray(filter.values)
                            ? filter.values.join(', ')
                            : String(filter.values)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
                    {explain.filterLogic}
                  </p>
                </Row>
              )}

              <Row label={t('explain.sort')}>
                <code dir="ltr" className="block text-start font-mono text-[11px] text-slate-400">
                  {explain.sort}
                </code>
              </Row>

              <Row label={t('explain.sql')}>
                <pre
                  dir="ltr"
                  className="max-h-52 overflow-auto rounded-lg border border-white/6 bg-ink-950/70 p-2.5 text-start font-mono text-[10.5px] leading-relaxed text-slate-400"
                >
                  <code>{explain.query}</code>
                </pre>
              </Row>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">
        {label}
      </h4>
      {children}
    </section>
  );
}
