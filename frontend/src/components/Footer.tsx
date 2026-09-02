import { useI18n } from '../i18n/LanguageProvider';

export function Footer() {
  const { t } = useI18n();

  return (
    <footer className="border-t border-white/6 py-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 text-xs text-slate-600 sm:flex-row sm:px-8">
        <p>{t('footer.built')}</p>
        <nav className="flex items-center gap-4">
          <a href="#api" className="transition hover:text-accent-400">
            {t('footer.docs')}
          </a>
          <span aria-hidden className="h-3 w-px bg-white/10" />
          <span dir="ltr" className="font-mono">
            task v1.0.0
          </span>
        </nav>
      </div>
    </footer>
  );
}
