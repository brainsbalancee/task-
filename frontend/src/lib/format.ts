/** Presentation helpers. The dataset is stored lowercase; the UI capitalises it. */

/** "civil engineer" -> "Civil Engineer" (small words left alone). */
const MINOR_WORDS = new Set(['and', 'or', 'of', 'the', 'at', 'in', 'for', 'to', 'a', 'an', '&']);

export function titleCase(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .split(' ')
    .map((word, i) =>
      i > 0 && MINOR_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ');
}

/** Up to two initials for the avatar. */
export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/**
 * Deterministic avatar gradient.
 * Hashing the id keeps a person's colour stable across pages and reloads.
 */
const AVATAR_GRADIENTS = [
  'from-sky-500 to-blue-600',
  'from-violet-500 to-purple-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-sky-600',
  'from-indigo-500 to-violet-600',
  'from-lime-500 to-emerald-600',
];

export function avatarGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length]!;
}

/** "2016-10" -> "Oct 2016"; "2008" -> "2008". */
export function formatDate(value: string | null, locale: string): string {
  if (!value) return '';
  const [year, month] = value.split('-');
  if (!month) return year ?? '';
  const date = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(date);
}

/** Escapes text, then re-allows the `<mark>` tags the search engine produced. */
export function sanitizeHighlight(html: string): string {
  const escaped = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return escaped.replace(/&lt;mark&gt;/g, '<mark>').replace(/&lt;\/mark&gt;/g, '</mark>');
}

/** Tailwind class merge helper for conditional classes. */
export function cx(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}
