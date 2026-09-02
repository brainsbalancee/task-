import { motion } from 'framer-motion';
import { useI18n } from '../i18n/LanguageProvider';
import type { ProfileSummary } from '../api/types';
import { BriefcaseIcon, CapIcon, PinIcon } from './Icons';
import { avatarGradient, cx, initials, sanitizeHighlight, titleCase } from '../lib/format';

interface Props {
  profile: ProfileSummary;
  index: number;
  onOpen: (id: string) => void;
  /** Skill values currently selected, highlighted inside the chip row. */
  activeSkills: string[];
  onSkillClick: (skill: string) => void;
}

const MAX_VISIBLE_SKILLS = 6;

/** One search result. Clicking anywhere but a skill chip opens the detail drawer. */
export function ProfileCard({ profile, index, onOpen, activeSkills, onSkillClick }: Props) {
  const { t, n, lang } = useI18n();
  const visibleSkills = profile.skills.slice(0, MAX_VISIBLE_SKILLS);
  const hiddenCount = profile.skillCount - visibleSkills.length;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.32, delay: Math.min(index * 0.03, 0.24), ease: [0.22, 1, 0.36, 1] }}
      onClick={() => onOpen(profile.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(profile.id);
        }
      }}
      className="glass group cursor-pointer rounded-2xl p-4 transition duration-300 hover:-translate-y-0.5 hover:border-accent-400/25 hover:bg-white/6 sm:p-5"
    >
      <div className="flex items-start gap-3.5">
        <span
          className={cx(
            'grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-sm font-bold text-white shadow-lg',
            avatarGradient(profile.id),
          )}
          aria-hidden
        >
          {initials(profile.fullName)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h3 className="text-[15px] font-semibold text-white transition group-hover:text-accent-400">
              {titleCase(profile.fullName)}
            </h3>
            {profile.jobTitleLevels.slice(0, 2).map((level) => (
              <span
                key={level}
                className="rounded-md bg-violet-400/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-400"
              >
                {level}
              </span>
            ))}
            {profile.score !== null && (
              <span className="ms-auto shrink-0 text-[10px] tabular-nums text-slate-600">
                {t('results.score', { score: n(Math.round(profile.score * 100) / 100) })}
              </span>
            )}
          </div>

          {/* Job line */}
          {(profile.jobTitle || profile.company) && (
            <p className="mt-1 flex items-center gap-1.5 text-[13px] text-slate-300">
              <BriefcaseIcon className="h-3.5 w-3.5 shrink-0 text-slate-600" />
              <span className="min-w-0 truncate">
                {titleCase(profile.jobTitle)}
                {profile.jobTitle && profile.company && (
                  <span className="text-slate-500"> {t('profile.at')} </span>
                )}
                {profile.company && <span className="text-slate-400">{titleCase(profile.company)}</span>}
              </span>
            </p>
          )}

          {/* Meta row */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px] text-slate-500">
            {profile.locationName && (
              <span className="flex items-center gap-1">
                <PinIcon className="h-3 w-3" />
                {titleCase(profile.locationName)}
              </span>
            )}
            {profile.topSchool && (
              <span className="flex items-center gap-1">
                <CapIcon className="h-3 w-3" />
                {titleCase(profile.topSchool)}
              </span>
            )}
            {profile.yearsExperience !== null && (
              <span className="tabular-nums">
                {t('profile.years', { years: n(profile.yearsExperience) })}
              </span>
            )}
            {profile.connections !== null && (
              <span className="tabular-nums">
                {t('profile.connections', { count: n(profile.connections) })}
              </span>
            )}
          </div>

          {/* Keyword snippet from the engine, or the profile summary as a fallback. */}
          {profile.highlight ? (
            <p
              dir="ltr"
              className="highlight mt-2.5 line-clamp-2 text-start text-xs leading-relaxed text-slate-500"
              dangerouslySetInnerHTML={{ __html: sanitizeHighlight(profile.highlight) }}
            />
          ) : (
            profile.summary && (
              <p dir="auto" className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-slate-500">
                {profile.summary}
              </p>
            )
          )}

          {/* Skill chips — clicking one toggles it as a filter. */}
          {visibleSkills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {visibleSkills.map((skill) => {
                const active = activeSkills.includes(skill);
                return (
                  <button
                    key={skill}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSkillClick(skill);
                    }}
                    className={cx(
                      'rounded-md px-2 py-0.5 text-[10.5px] font-medium transition',
                      active
                        ? 'bg-accent-500/25 text-accent-400 ring-1 ring-accent-400/40'
                        : 'bg-white/6 text-slate-400 hover:bg-accent-500/15 hover:text-accent-400',
                    )}
                  >
                    {skill}
                  </button>
                );
              })}
              {hiddenCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10.5px] text-slate-600" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
                  {t('results.skillsMore', { count: n(hiddenCount) })}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.article>
  );
}
