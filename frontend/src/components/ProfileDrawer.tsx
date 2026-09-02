import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Profile } from '../api/types';
import { useI18n } from '../i18n/LanguageProvider';
import { BriefcaseIcon, CapIcon, CloseIcon, LinkIcon, PinIcon } from './Icons';
import { avatarGradient, cx, formatDate, initials, titleCase } from '../lib/format';

interface Props {
  profileId: string | null;
  onClose: () => void;
}

/**
 * Detail panel for one profile.
 *
 * Slides in from the inline-end edge, so it enters from the right in English
 * and from the left in Persian. Fetches `GET /api/profiles/:id` on open —
 * the list response deliberately omits the full history to stay small.
 */
export function ProfileDrawer({ profileId, onClose }: Props) {
  const { t, n, lang, isRtl } = useI18n();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profileId) return;

    const controller = new AbortController();
    setLoading(true);
    setProfile(null);

    api
      .profile(profileId, controller.signal)
      .then((response) => {
        setProfile(response.data);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (err.name !== 'AbortError') setLoading(false);
      });

    return () => controller.abort();
  }, [profileId]);

  // Escape closes; body scroll is locked while the drawer is open.
  useEffect(() => {
    if (!profileId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [profileId, onClose]);

  const locale = lang === 'fa' ? 'fa-IR' : 'en-US';

  return (
    <AnimatePresence>
      {profileId && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-60 bg-ink-950/70 backdrop-blur-sm"
          />

          <motion.aside
            role="dialog"
            aria-modal="true"
            initial={{ x: isRtl ? '-100%' : '100%' }}
            animate={{ x: 0 }}
            exit={{ x: isRtl ? '-100%' : '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className="glass-strong fixed inset-y-0 end-0 z-70 flex w-full max-w-lg flex-col border-s border-white/10"
          >
            <header className="flex items-start justify-between gap-3 border-b border-white/8 p-5">
              {profile ? (
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={cx(
                      'grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br font-bold text-white shadow-lg',
                      avatarGradient(profile.id),
                    )}
                  >
                    {initials(profile.fullName)}
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold text-white">
                      {titleCase(profile.fullName)}
                    </h2>
                    {profile.jobTitle && (
                      <p className="truncate text-sm text-slate-400">{titleCase(profile.jobTitle)}</p>
                    )}
                    {profile.location.name && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <PinIcon className="h-3 w-3" />
                        {titleCase(profile.location.name)}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-12 w-40 animate-pulse rounded-lg bg-white/6" />
              )}

              <button
                onClick={onClose}
                aria-label={t('profile.close')}
                className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-white/8 hover:text-white"
              >
                <CloseIcon className="h-4.5 w-4.5" />
              </button>
            </header>

            <div className="flex-1 space-y-6 overflow-y-auto p-5">
              {loading && (
                <div className="space-y-3">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-16 animate-pulse rounded-xl bg-white/4" />
                  ))}
                </div>
              )}

              {profile && (
                <>
                  {profile.linkedinUrl && (
                    <a
                      href={`https://${profile.linkedinUrl.replace(/^https?:\/\//, '')}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-accent-400/40 hover:text-accent-400"
                    >
                      <LinkIcon className="h-3.5 w-3.5" />
                      {t('profile.linkedin')}
                    </a>
                  )}

                  <Section title={t('profile.summary')}>
                    <p dir="auto" className="text-sm leading-relaxed text-slate-400">
                      {profile.summary ?? t('profile.noSummary')}
                    </p>
                  </Section>

                  {profile.skills.length > 0 && (
                    <Section title={`${t('profile.skills')} · ${n(profile.skills.length)}`}>
                      <div className="flex flex-wrap gap-1.5">
                        {profile.skills.map((skill) => (
                          <span
                            key={skill}
                            className="rounded-md bg-white/6 px-2 py-1 text-[11px] text-slate-300"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </Section>
                  )}

                  {profile.experience.length > 0 && (
                    <Section title={t('profile.experience')}>
                      <ol className="relative space-y-4 border-s border-white/10 ps-4">
                        {profile.experience.map((item, i) => (
                          <li key={i} className="relative">
                            <span
                              className={cx(
                                'absolute -start-[21px] top-1.5 h-2 w-2 rounded-full ring-4 ring-ink-900',
                                item.isCurrent ? 'bg-mint-400' : 'bg-slate-600',
                              )}
                            />
                            <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-slate-200">
                              {titleCase(item.title) || '—'}
                              {item.isCurrent && (
                                <span className="rounded bg-mint-400/15 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-mint-400">
                                  {t('profile.current')}
                                </span>
                              )}
                            </p>
                            {item.company && (
                              <p className="flex items-center gap-1.5 text-xs text-slate-400">
                                <BriefcaseIcon className="h-3 w-3 text-slate-600" />
                                {titleCase(item.company)}
                              </p>
                            )}
                            <p className="mt-0.5 text-[11px] text-slate-600">
                              {formatDate(item.startDate, locale)}
                              {(item.startDate || item.endDate) && ' — '}
                              {item.endDate ? formatDate(item.endDate, locale) : t('profile.present')}
                              {item.locationName && ` · ${titleCase(item.locationName)}`}
                            </p>
                          </li>
                        ))}
                      </ol>
                    </Section>
                  )}

                  {profile.education.length > 0 && (
                    <Section title={t('profile.education')}>
                      <ul className="space-y-3">
                        {profile.education.map((item, i) => (
                          <li key={i} className="flex gap-2.5">
                            <CapIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
                            <div className="min-w-0">
                              <p className="text-[13px] font-semibold text-slate-200">
                                {titleCase(item.school) || '—'}
                              </p>
                              {(item.degrees.length > 0 || item.majors.length > 0) && (
                                <p className="text-xs text-slate-400">
                                  {[titleCase(item.degrees[0]), titleCase(item.majors[0])]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </p>
                              )}
                              {(item.startDate || item.endDate) && (
                                <p className="mt-0.5 text-[11px] text-slate-600">
                                  {formatDate(item.startDate, locale)}
                                  {item.startDate && item.endDate && ' — '}
                                  {formatDate(item.endDate, locale)}
                                </p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </Section>
                  )}

                  {profile.interests.length > 0 && (
                    <Section title={t('profile.interests')}>
                      <div className="flex flex-wrap gap-1.5">
                        {profile.interests.map((interest) => (
                          <span
                            key={interest}
                            className="rounded-md bg-violet-400/10 px-2 py-1 text-[11px] text-violet-300"
                          >
                            {interest}
                          </span>
                        ))}
                      </div>
                    </Section>
                  )}
                </>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
        {title}
      </h3>
      {children}
    </section>
  );
}
