import { parsePythonLiteral, type PyValue } from './python-literal.js';
import type { RawRow } from './normalize.js';

/**
 * Structural recovery for records whose columns cannot be trusted by position.
 *
 * Most records in the source file lost a column somewhere in the middle (a null
 * that the exporter dropped instead of writing as empty) and gained one further
 * along, so the field count lands back on 77 while the values in between sit one
 * slot off. Reading such a record by column index yields plausible-looking
 * nonsense — an industry in the job-title column, a phone list in the summary.
 *
 * Two position-independent handles make recovery possible:
 *
 *  1. **The salary anchor.** `inferred_salary` has a unique shape
 *     ("85,000-100,000", ">250,000") and occurs in every record in the file.
 *     Locating it fixes the offsets of its neighbours, whatever the absolute
 *     alignment is.
 *  2. **Literal shape.** The Python-literal blobs are self-delimiting and carry
 *     signature keys (`'company'` -> experience, `'school'` -> education), so
 *     they can be found by scanning the raw text.
 *
 * Every recovered value is shape-checked before it is accepted; anything that
 * fails validation is left empty rather than guessed. Recovered rows are marked
 * with `__recovered` so the ingest can report how many took this path.
 */

// ---------------------------------------------------------------------------
// Column offsets relative to the salary anchor (header index 42)
// ---------------------------------------------------------------------------
const OFFSET = {
  locationName: -9,
  locality: -8,
  region: -6,
  country: -5,
  continent: -4,
  connections: -1,
  salary: 0,
  years: 1,
  summary: 2,
  interests: 5,
  skills: 6,
  experience: 11,
  education: 12,
} as const;

const SALARY = /^[<>]?\d{2,3},\d{3}(?:-\d{2,3},\d{3})?$/;

// ---------------------------------------------------------------------------
// Literal helpers
// ---------------------------------------------------------------------------

const asString = (v: PyValue): string => (typeof v === 'string' ? v : '');
const get = (v: PyValue, key: string): PyValue =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v[key] ?? null) : null;

/** Parses a CSV cell holding a Python literal list. Returns null if it is not one. */
function parseListCell(cell: string | undefined): PyValue[] | null {
  const text = (cell ?? '').trim();
  if (!text.startsWith('[')) return null;
  try {
    // Inside a quoted CSV field every `"` is doubled; undo that first.
    const value = parsePythonLiteral(text.replace(/""/g, '"'));
    return Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

const isStringList = (v: PyValue[]): boolean => v.every((x) => typeof x === 'string');

/**
 * A plain string list that actually looks like skills or interests.
 *
 * The neighbouring columns (`location_names`, `regions`, `countries`,
 * `phone_numbers`) are string lists too, so shape alone is not enough — a
 * one-slot drift would otherwise fill someone's skill set with city names.
 * Skills never contain commas and phone numbers always start with "+".
 */
const isTagList = (v: PyValue[]): boolean =>
  isStringList(v) &&
  (v as string[]).every((s) => !s.includes(',') && !s.startsWith('+') && s.length <= 60);
const hasKey = (v: PyValue[], key: string): boolean =>
  v.length === 0 || (typeof v[0] === 'object' && v[0] !== null && key in (v[0] as object));

/** Walks the raw record text and extracts every top-level `[...]` literal. */
function findLiterals(text: string): PyValue[][] {
  const out: PyValue[][] = [];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== '[') continue;
    const next = text[i + 1];
    if (next !== '{' && next !== "'" && next !== '"') continue;

    const end = matchBracket(text, i);
    if (end === -1) continue;

    const value = parseListCell(text.slice(i, end + 1));
    if (value && value.length > 0) out.push(value);
    i = end;
  }
  return out;
}

/** Index of the `]` closing the `[` at `start`, or -1. String-aware. */
function matchBracket(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let quote = '';
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i]!;
    if (inString) {
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === quote) inString = false;
      continue;
    }
    if (ch === "'" || ch === '"') {
      inString = true;
      quote = ch;
    } else if (ch === '[' || ch === '{') {
      depth += 1;
    } else if (ch === ']' || ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Fallback when the anchored skills cell is unusable.
 *
 * A record holds several plain-string lists (skills, interests, phone numbers,
 * location names, regions, countries). Skills is the longest list of short,
 * lowercase, comma-free phrases — phone numbers start with "+", location values
 * carry commas. The four-item floor stops a two-item `countries` list from
 * being mistaken for someone's skill set.
 */
function pickSkills(candidates: PyValue[][]): string[] {
  let best: string[] = [];
  for (const list of candidates) {
    if (!isTagList(list)) continue;
    const items = list as string[];
    if (items.length < 4 || items.length <= best.length) continue;
    if (items.every((s) => s === s.toLowerCase())) best = items;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Scalar validation
// ---------------------------------------------------------------------------

/** Free text that is definitely not a serialised structure or a number. */
function plainText(value: string | undefined, maxLength = 100): string {
  const v = (value ?? '').trim();
  if (v === '' || v.length > maxLength) return '';
  if (v.startsWith('[') || v.startsWith('{') || v.includes("':")) return '';
  if (/^[\d.,>< -]+$/.test(v)) return '';
  if (v.includes('linkedin.com') || v.includes('facebook.com') || v.startsWith('+')) return '';
  return v;
}

const numericText = (value: string | undefined): string => {
  const v = (value ?? '').trim();
  return /^\d+(\.\d+)?$/.test(v) ? v : '';
};

/** A single place name: "texas", "united states" — not a number or a list. */
const placeName = (value: string | undefined): string => {
  const v = (value ?? '').trim();
  return /^[a-z][a-z .'()-]{1,40}$/.test(v) ? v : '';
};

// ---------------------------------------------------------------------------
// Recovery
// ---------------------------------------------------------------------------

/**
 * Rebuilds as much of a damaged record as possible.
 * `flat` is the (misaligned) field list; `text` is the record's raw CSV text.
 */
export function salvageRecord(flat: string[], text: string): RawRow | null {
  const [fullName = '', firstName = '', lastName = '', gender = '', linkedinUrl = ''] = flat;
  if (!fullName || !linkedinUrl.includes('linkedin.com/in/')) return null;

  // --- anchor ---------------------------------------------------------------
  const anchor = flat.findIndex((f) => SALARY.test((f ?? '').trim()));
  const at = (offset: keyof typeof OFFSET): string | undefined =>
    anchor === -1 ? undefined : flat[anchor + OFFSET[offset]];

  /** Anchored cell first, blob scan second — both shape-validated. */
  const listAt = (offset: keyof typeof OFFSET, validate: (v: PyValue[]) => boolean): PyValue[] | null => {
    const anchored = parseListCell(at(offset));
    return anchored && validate(anchored) ? anchored : null;
  };

  const blobs = findLiterals(text);

  const experience =
    listAt('experience', (v) => hasKey(v, 'company')) ??
    blobs.find((v) => hasKey(v, 'company') && !isStringList(v)) ??
    [];
  const education =
    listAt('education', (v) => hasKey(v, 'school')) ??
    blobs.find((v) => hasKey(v, 'school') && !isStringList(v)) ??
    [];
  const skills = (listAt('skills', isTagList) as string[] | null) ?? pickSkills(blobs);
  const interests = (listAt('interests', isTagList) as string[] | null) ?? [];

  // --- current position, read from the primary experience entry -------------
  const primary = experience.find((e) => get(e, 'is_primary') === true) ?? experience[0] ?? null;
  const title = primary ? get(primary, 'title') : null;
  const company = primary ? get(primary, 'company') : null;
  const levels = get(title, 'levels');

  // The experience blob is authoritative; columns 10-11 are the fallback and
  // are validated because the corruption can begin before them.
  const jobTitle = asString(get(title, 'name')) || plainText(flat[11]);
  const industry = asString(get(company, 'industry')) || plainText(flat[10], 60);

  // --- location -------------------------------------------------------------
  const anchoredLocation = (at('locationName') ?? '').trim();
  const companyLocation = asString(get(get(company, 'location'), 'name'));
  const useAnchored = anchoredLocation.includes(',') && anchoredLocation.length < 120;
  const locationName = useAnchored ? anchoredLocation : companyLocation;
  const parts = locationName.split(',').map((s) => s.trim());

  return {
    full_name: fullName,
    first_name: firstName,
    last_name: lastName,
    gender: gender === 'male' || gender === 'female' ? gender : '',
    linkedin_url: linkedinUrl,
    linkedin_username: flat[5] ?? '',
    linkedin_id: /^\d+$/.test((flat[6] ?? '').trim()) ? flat[6]!.trim() : '',

    industry,
    job_title: jobTitle,
    job_title_role: asString(get(title, 'role')),
    job_title_sub_role: asString(get(title, 'sub_role')),
    job_title_levels: toPythonLiteral(Array.isArray(levels) ? levels : []),
    job_start_date: primary ? asString(get(primary, 'start_date')) : '',

    job_company_name: asString(get(company, 'name')),
    job_company_industry: asString(get(company, 'industry')),
    job_company_size: asString(get(company, 'size')),
    job_company_website: asString(get(company, 'website')),
    job_company_linkedin_url: asString(get(company, 'linkedin_url')),

    location_name: locationName,
    location_locality: placeName(useAnchored ? at('locality') : parts[0]),
    location_region: placeName(useAnchored ? at('region') : (parts.length > 2 ? parts[1] : '')),
    location_country: placeName(useAnchored ? at('country') : parts[parts.length - 1]),
    location_continent: placeName(useAnchored ? at('continent') : ''),

    // Re-serialised as Python literals so `normalizeRow` consumes a recovered
    // row exactly as it consumes an undamaged one — no special cases downstream.
    skills: toPythonLiteral(skills),
    interests: toPythonLiteral(interests),
    certifications: '[]',
    languages: '[]',
    experience: toPythonLiteral(experience),
    education: toPythonLiteral(education),

    summary: plainText(at('summary'), 4000),
    inferred_years_experience: numericText(at('years')),
    linkedin_connections: numericText(at('connections')),
    inferred_salary: (at('salary') ?? '').trim(),
    github_url: '',
    twitter_url: '',
    __recovered: '1',
  };
}

/** JSON -> Python-literal spelling, so the value round-trips through the normaliser. */
function toPythonLiteral(value: PyValue): string {
  if (value === null || value === undefined) return 'None';
  if (value === true) return 'True';
  if (value === false) return 'False';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  if (Array.isArray(value)) return `[${value.map(toPythonLiteral).join(', ')}]`;
  return `{${Object.entries(value)
    .map(([k, v]) => `'${k}': ${toPythonLiteral(v)}`)
    .join(', ')}}`;
}
