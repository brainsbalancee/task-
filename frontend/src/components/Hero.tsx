import { motion, useReducedMotion } from 'framer-motion';
import { useI18n } from '../i18n/LanguageProvider';
import { useStats } from '../hooks/useStats';
import { ArrowDown, SearchIcon } from './Icons';
import { AnimatedNumber } from './AnimatedNumber';
import type { TranslationKey } from '../i18n/translations';
import type { DatasetStats } from '../api/types';

const STATS: { key: keyof DatasetStats; label: TranslationKey }[] = [
  { key: 'profiles', label: 'hero.stat.profiles' },
  { key: 'skills', label: 'hero.stat.skills' },
  { key: 'companies', label: 'hero.stat.companies' },
  { key: 'experiences', label: 'hero.stat.positions' },
];

/** Landing hero: drifting orbs, staggered copy, and live dataset counters. */
export function Hero({ onJumpToSearch }: { onJumpToSearch: () => void }) {
  const { t } = useI18n();
  const stats = useStats();
  const reduceMotion = useReducedMotion();

  const rise = {
    hidden: { opacity: 0, y: reduceMotion ? 0 : 26 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <section id="top" className="relative overflow-hidden pt-28 pb-20 sm:pt-36 sm:pb-28">
      {/* Drifting colour orbs behind the copy. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-float-slow absolute -top-24 start-[8%] h-72 w-72 rounded-full bg-accent-500/22 blur-[100px]" />
        <div
          className="animate-float-slow absolute top-16 end-[6%] h-80 w-80 rounded-full bg-violet-400/18 blur-[110px]"
          style={{ animationDelay: '-5s' }}
        />
        <div
          className="animate-float-slow absolute bottom-0 start-1/3 h-64 w-64 rounded-full bg-mint-400/12 blur-[100px]"
          style={{ animationDelay: '-9s' }}
        />
      </div>

      <motion.div
        initial="hidden"
        animate="show"
        transition={{ staggerChildren: 0.09, delayChildren: 0.12 }}
        className="relative mx-auto max-w-4xl px-5 text-center sm:px-8"
      >
        <motion.div variants={rise} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[11px] font-medium tracking-wide text-slate-300 backdrop-blur sm:text-xs">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint-400 opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint-400" />
            </span>
            {t('hero.badge')}
          </span>
        </motion.div>

        <motion.h1
          variants={rise}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-balance mt-7 text-4xl font-extrabold leading-[1.12] tracking-tight text-white sm:text-6xl"
        >
          {t('hero.title.a')}{' '}
          <span className="animate-shimmer bg-gradient-to-r from-accent-400 via-violet-400 to-mint-400 bg-clip-text text-transparent">
            {t('hero.title.b')}
          </span>
          <br className="hidden sm:block" />{' '}
          <span className="text-slate-300">{t('hero.title.c')}</span>
        </motion.h1>

        <motion.p
          variants={rise}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-balance mx-auto mt-6 max-w-2xl text-[15px] leading-relaxed text-slate-400 sm:text-lg"
        >
          {t('hero.subtitle')}
        </motion.p>

        <motion.div
          variants={rise}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mt-9 flex flex-wrap items-center justify-center gap-3"
        >
          <button
            onClick={onJumpToSearch}
            className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-accent-500/25 transition hover:shadow-xl hover:shadow-accent-500/35 active:scale-[0.98]"
          >
            <SearchIcon className="h-4 w-4" />
            {t('hero.cta.primary')}
          </button>
          <a
            href="#how"
            className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-200 backdrop-blur transition hover:border-white/25 hover:bg-white/10 hover:text-white"
          >
            {t('hero.cta.secondary')}
          </a>
        </motion.div>

        {/* Live counters — proof the frontend is talking to the API. */}
        <motion.dl
          variants={rise}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4"
        >
          {STATS.map(({ key, label }) => (
            <div
              key={key}
              className="glass rounded-2xl px-4 py-5 transition hover:border-accent-400/25 hover:bg-white/6"
            >
              <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                {t(label)}
              </dt>
              <dd className="mt-1.5 text-2xl font-bold text-white tabular-nums sm:text-3xl">
                <AnimatedNumber value={(stats?.[key] as number | undefined) ?? 0} />
              </dd>
            </div>
          ))}
        </motion.dl>

        <motion.button
          onClick={onJumpToSearch}
          variants={rise}
          transition={{ duration: 0.7 }}
          className="mx-auto mt-14 flex flex-col items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-600 transition hover:text-slate-400"
        >
          {t('hero.scroll')}
          <motion.span
            animate={reduceMotion ? {} : { y: [0, 6, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ArrowDown className="h-4 w-4" />
          </motion.span>
        </motion.button>
      </motion.div>
    </section>
  );
}
