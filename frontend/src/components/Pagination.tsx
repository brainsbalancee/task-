import { useI18n } from '../i18n/LanguageProvider';
import { ChevronLeft, ChevronRight } from './Icons';
import { cx } from '../lib/format';

interface Props {
  page: number;
  pages: number;
  onChange: (page: number) => void;
}

/** Builds a compact page list: 1 … 4 5 6 … 20 */
function pageWindow(page: number, pages: number): (number | 'gap')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);

  const items: (number | 'gap')[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pages - 1, page + 1);

  if (start > 2) items.push('gap');
  for (let i = start; i <= end; i += 1) items.push(i);
  if (end < pages - 1) items.push('gap');
  items.push(pages);

  return items;
}

export function Pagination({ page, pages, onChange }: Props) {
  const { t, n, isRtl } = useI18n();
  if (pages <= 1) return null;

  // In RTL the "previous" affordance points the other way.
  const PrevIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
    <nav className="mt-6 flex flex-wrap items-center justify-center gap-1.5" aria-label={t('page.of', { page, pages })}>
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="flex items-center gap-1 rounded-lg border border-white/8 bg-white/4 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-white/20 hover:bg-white/8 disabled:pointer-events-none disabled:opacity-35"
      >
        <PrevIcon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{t('page.prev')}</span>
      </button>

      {pageWindow(page, pages).map((item, i) =>
        item === 'gap' ? (
          <span key={`gap-${i}`} className="px-1 text-slate-600">
            …
          </span>
        ) : (
          <button
            key={item}
            onClick={() => onChange(item)}
            aria-current={item === page ? 'page' : undefined}
            className={cx(
              'min-w-9 rounded-lg px-2.5 py-2 text-xs font-semibold tabular-nums transition',
              item === page
                ? 'bg-gradient-to-r from-accent-500 to-violet-500 text-white shadow-lg shadow-accent-500/20'
                : 'border border-white/8 bg-white/4 text-slate-400 hover:border-white/20 hover:bg-white/8 hover:text-white',
            )}
          >
            {n(item)}
          </button>
        ),
      )}

      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= pages}
        className="flex items-center gap-1 rounded-lg border border-white/8 bg-white/4 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-white/20 hover:bg-white/8 disabled:pointer-events-none disabled:opacity-35"
      >
        <span className="hidden sm:inline">{t('page.next')}</span>
        <NextIcon className="h-3.5 w-3.5" />
      </button>
    </nav>
  );
}
