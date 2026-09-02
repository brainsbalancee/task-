import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/LanguageProvider';
import { GlobeIcon } from './Icons';
import { cx } from '../lib/format';

/** Sticky header. Gains a frosted background once the page scrolls. */
export function Nav({ onJumpToSearch }: { onJumpToSearch: () => void }) {
  const { t, toggleLang, lang } = useI18n();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={cx(
        'fixed inset-x-0 top-0 z-50 transition-colors duration-300',
        scrolled ? 'border-b border-white/8 bg-ink-950/70 backdrop-blur-xl' : 'border-b border-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
        <a href="#top" className="group flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-accent-400 to-violet-400 shadow-lg shadow-accent-500/25">
            <svg viewBox="0 0 100 100" className="h-5 w-5" aria-hidden>
              <path
                d="M28 62 L44 34 L56 52 L64 42 L74 62"
                stroke="white"
                strokeWidth="9"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-[15px] font-bold tracking-tight text-white">{t('app.name')}</span>
            <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
              {t('app.tagline')}
            </span>
          </span>
        </a>

        <nav className="hidden items-center gap-1 md:flex">
          <button
            onClick={onJumpToSearch}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
          >
            {t('nav.search')}
          </button>
          <a
            href="#how"
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
          >
            {t('nav.how')}
          </a>
          <a
            href="#api"
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
          >
            {t('nav.api')}
          </a>
        </nav>

        <button
          onClick={toggleLang}
          aria-label={t('lang.label')}
          className="group flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-accent-400/40 hover:bg-accent-400/10 hover:text-white"
        >
          <GlobeIcon className="h-4 w-4 text-accent-400 transition group-hover:rotate-180 duration-500" />
          <span className={lang === 'en' ? 'font-fa' : ''}>{t('lang.toggle')}</span>
        </button>
      </div>
    </motion.header>
  );
}
