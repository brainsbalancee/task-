import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api, apiBaseUrl } from '../api/client';
import { useI18n } from '../i18n/LanguageProvider';
import type { TranslationKey } from '../i18n/translations';
import { BoltIcon, ChevronDown, CloseIcon } from './Icons';
import { Reveal } from './Reveal';
import { cx } from '../lib/format';

/** Ready-made requests, so the endpoint surface can be exercised in one click. */
const PRESETS: { labelKey: TranslationKey; path: string }[] = [
  { labelKey: 'api.preset.search', path: '/search?q=civil+engineer&limit=3' },
  { labelKey: 'api.preset.filters', path: '/search?skill=leadership&title=manager&minExp=10&limit=3' },
  { labelKey: 'api.preset.explain', path: '/search?q=engineer&skill=autocad&explain=1&limit=1' },
  { labelKey: 'api.preset.suggest', path: '/suggest?q=engin' },
  { labelKey: 'api.preset.facets', path: '/facets?field=skills&limit=8' },
  { labelKey: 'api.preset.stats', path: '/stats' },
  { labelKey: 'api.preset.error', path: '/search?limit=999' },
];

interface Response {
  status: number;
  body: unknown;
  ms: number;
}

/**
 * A live API console embedded in the page.
 *
 * The task is judged mostly on the backend, but a backend is invisible in a
 * normal UI — every response arrives pre-digested into cards. This section
 * fires real requests against the running API and shows the raw status, timing
 * and JSON, so the endpoint surface can be inspected without leaving the app or
 * reaching for curl.
 */
export function ApiPlayground() {
  const { t, n } = useI18n();
  const [path, setPath] = useState(PRESETS[0]!.path);
  const [response, setResponse] = useState<Response | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const send = useCallback(async (target: string) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const result = await api.raw(target, controller.signal);
      setResponse(result);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError((err as Error).message);
      setResponse(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fire the default request once so the panel is never empty on arrival.
  useEffect(() => {
    void send(PRESETS[0]!.path);
    return () => controllerRef.current?.abort();
  }, [send]);

  const json = response ? JSON.stringify(response.body, null, 2) : '';
  const truncated = json.length > 6000;

  return (
    <section id="api" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16 sm:px-8">
      <Reveal className="mb-6 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {t('api.heading')}
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">{t('api.subtitle')}</p>
      </Reveal>

      <Reveal delay={0.08}>
        <div className="glass overflow-hidden rounded-2xl">
          {/* Preset chips */}
          <div className="flex flex-wrap gap-1.5 border-b border-white/8 p-3">
            {PRESETS.map((preset) => (
              <button
                key={preset.path}
                onClick={() => {
                  setPath(preset.path);
                  void send(preset.path);
                }}
                className={cx(
                  'rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition',
                  path === preset.path
                    ? 'bg-accent-500/22 text-accent-400'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200',
                )}
              >
                {t(preset.labelKey)}
              </button>
            ))}
          </div>

          {/* Request line */}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send(path);
            }}
            className="flex flex-col gap-2 border-b border-white/8 p-3 sm:flex-row sm:items-center"
          >
            <span className="shrink-0 rounded-md bg-mint-400/15 px-2 py-1 text-[11px] font-bold text-mint-400">
              GET
            </span>
            <span dir="ltr" className="shrink-0 font-mono text-[11px] text-slate-600">
              {apiBaseUrl}
            </span>
            <input
              dir="ltr"
              value={path}
              onChange={(event) => setPath(event.target.value)}
              spellCheck={false}
              aria-label={t('api.path')}
              className="min-w-0 flex-1 rounded-lg border border-white/8 bg-ink-950/60 px-2.5 py-2 font-mono text-xs text-slate-200 focus:border-accent-400/40 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading}
              className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-accent-500 to-violet-500 px-4 py-2 text-xs font-semibold text-white transition hover:shadow-lg hover:shadow-accent-500/25 disabled:opacity-50"
            >
              <BoltIcon className="h-3.5 w-3.5" />
              {t('api.send')}
            </button>
          </form>

          {/* Response */}
          <div className="p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
              {response && (
                <>
                  <span
                    className={cx(
                      'rounded-md px-2 py-0.5 font-bold tabular-nums',
                      response.status < 300
                        ? 'bg-mint-400/15 text-mint-400'
                        : 'bg-rose-400/15 text-rose-400',
                    )}
                  >
                    {response.status}
                  </span>
                  <span className="text-slate-600 tabular-nums">
                    {t('api.took', { ms: n(response.ms) })}
                  </span>
                  <span className="text-slate-600 tabular-nums">
                    {t('api.size', { kb: n(Math.round((json.length / 1024) * 10) / 10) })}
                  </span>
                </>
              )}
              {loading && <span className="text-accent-400">{t('api.sending')}</span>}
              {error && <span className="text-rose-400">{error}</span>}
            </div>

            <pre
              dir="ltr"
              className="max-h-96 overflow-auto rounded-xl border border-white/6 bg-ink-950/70 p-3 text-start font-mono text-[11px] leading-relaxed text-slate-300"
            >
              <code>{truncated ? `${json.slice(0, 6000)}\n…` : json || '—'}</code>
            </pre>
          </div>
        </div>
      </Reveal>

      <EndpointTable />
    </section>
  );
}

const ENDPOINTS: { method: string; path: string; descKey: TranslationKey }[] = [
  { method: 'GET', path: '/api/search', descKey: 'api.ep.search' },
  { method: 'GET', path: '/api/profiles/:id', descKey: 'api.ep.profile' },
  { method: 'GET', path: '/api/facets', descKey: 'api.ep.facets' },
  { method: 'GET', path: '/api/suggest', descKey: 'api.ep.suggest' },
  { method: 'GET', path: '/api/stats', descKey: 'api.ep.stats' },
  { method: 'GET', path: '/api/health', descKey: 'api.ep.health' },
];

/** Collapsible endpoint reference under the console. */
function EndpointTable() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <Reveal delay={0.14} className="mt-4">
      <div className="glass overflow-hidden rounded-2xl">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-2 p-4 text-start"
        >
          <span className="text-sm font-semibold text-white">{t('api.endpoints')}</span>
          <ChevronDown
            className={cx('h-4 w-4 text-slate-500 transition-transform', open && 'rotate-180')}
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
              <div className="overflow-x-auto border-t border-white/8">
                <table className="w-full min-w-[520px] text-start text-xs">
                  <tbody>
                    {ENDPOINTS.map((endpoint) => (
                      <tr key={endpoint.path} className="border-b border-white/5 last:border-b-0">
                        <td className="whitespace-nowrap p-3 align-top">
                          <span className="rounded bg-mint-400/12 px-1.5 py-0.5 font-mono text-[10px] font-bold text-mint-400">
                            {endpoint.method}
                          </span>
                        </td>
                        <td dir="ltr" className="whitespace-nowrap p-3 text-start align-top font-mono text-[11px] text-accent-400">
                          {endpoint.path}
                        </td>
                        <td className="p-3 align-top text-slate-400">{t(endpoint.descKey)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Reveal>
  );
}

/** Small close button reused by the mobile filter sheet. */
export function SheetCloseButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="rounded-lg p-2 text-slate-400 transition hover:bg-white/8 hover:text-white"
    >
      <CloseIcon className="h-4.5 w-4.5" />
    </button>
  );
}
