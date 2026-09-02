import { useCallback, useRef } from 'react';
import { ApiPlayground } from './components/ApiPlayground';
import { Features } from './components/Features';
import { Footer } from './components/Footer';
import { Hero } from './components/Hero';
import { HowItWorks } from './components/HowItWorks';
import { Nav } from './components/Nav';
import { SearchSection } from './components/SearchSection';
import { useI18n } from './i18n/LanguageProvider';

export default function App() {
  const searchRef = useRef<HTMLElement>(null);
  const { lang } = useI18n();

  const jumpToSearch = useCallback(() => {
    searchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Focus the keyword input once the scroll settles.
    window.setTimeout(() => {
      searchRef.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
    }, 520);
  }, []);

  return (
    // Re-keying on language forces a clean remount, so animations replay in the
    // new direction instead of interpolating between RTL and LTR layouts.
    <div key={lang} className="flex min-h-screen flex-col">
      <Nav onJumpToSearch={jumpToSearch} />
      <main className="flex-1">
        <Hero onJumpToSearch={jumpToSearch} />
        <Features />
        <SearchSection ref={searchRef} />
        <HowItWorks />
        <ApiPlayground />
      </main>
      <Footer />
    </div>
  );
}
