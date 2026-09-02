import { useI18n } from '../i18n/LanguageProvider';
import { Reveal } from './Reveal';
import type { TranslationKey } from '../i18n/translations';

const STEPS: { title: TranslationKey; body: TranslationKey; tint: string; tag: string }[] = [
  { title: 'how.step1.title', body: 'how.step1.body', tint: 'from-mint-400 to-emerald-600', tag: 'SQLite · FTS5' },
  { title: 'how.step2.title', body: 'how.step2.body', tint: 'from-accent-400 to-sky-600', tag: 'Express · Zod' },
  { title: 'how.step3.title', body: 'how.step3.body', tint: 'from-violet-400 to-purple-600', tag: 'React · Vite' },
];

/** Architecture walkthrough — the request path, one card per layer. */
export function HowItWorks() {
  const { t, n } = useI18n();

  return (
    <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16 sm:px-8">
      <Reveal className="mb-8 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {t('how.heading')}
        </h2>
        <p className="mt-2 text-sm text-slate-500">{t('how.subtitle')}</p>
      </Reveal>

      <div className="grid gap-4 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <Reveal key={step.title} delay={i * 0.1} className="h-full">
            <article className="glass relative h-full overflow-hidden rounded-2xl p-5">
              {/* Step number, watermarked behind the copy. */}
              <span
                aria-hidden
                className="pointer-events-none absolute -top-3 end-2 text-7xl font-black text-white/4 tabular-nums"
              >
                {n(i + 1)}
              </span>

              <span
                className={`inline-block h-1 w-10 rounded-full bg-gradient-to-r ${step.tint}`}
                aria-hidden
              />
              <h3 className="mt-4 text-base font-semibold text-white">{t(step.title)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{t(step.body)}</p>
              <span
                dir="ltr"
                className="mt-4 inline-block rounded-md border border-white/8 bg-ink-950/60 px-2 py-1 font-mono text-[10.5px] text-slate-500"
              >
                {step.tag}
              </span>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
