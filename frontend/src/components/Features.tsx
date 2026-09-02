import { useI18n } from '../i18n/LanguageProvider';
import { BoltIcon, LayersIcon, SparkIcon } from './Icons';
import { Reveal } from './Reveal';
import type { TranslationKey } from '../i18n/translations';

const FEATURES: {
  icon: typeof BoltIcon;
  title: TranslationKey;
  body: TranslationKey;
  tint: string;
}[] = [
  { icon: SparkIcon, title: 'feature.1.title', body: 'feature.1.body', tint: 'text-accent-400' },
  { icon: LayersIcon, title: 'feature.2.title', body: 'feature.2.body', tint: 'text-violet-400' },
  { icon: BoltIcon, title: 'feature.3.title', body: 'feature.3.body', tint: 'text-mint-400' },
];

/** Three-card strip explaining what makes the search behave the way it does. */
export function Features() {
  const { t } = useI18n();

  return (
    <section className="mx-auto max-w-6xl px-5 pb-6 sm:px-8">
      <div className="grid gap-4 sm:grid-cols-3">
        {FEATURES.map((feature, i) => (
          <Reveal key={feature.title} delay={i * 0.09}>
            <article className="glass group h-full rounded-2xl p-5 transition duration-300 hover:-translate-y-1 hover:border-white/15 hover:bg-white/6">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5">
                <feature.icon className={`h-5 w-5 ${feature.tint}`} />
              </span>
              <h3 className="mt-4 text-[15px] font-semibold text-white">{t(feature.title)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{t(feature.body)}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
