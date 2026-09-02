import type { Education, Experience, Location, Profile } from '../domain/profile.js';
import { parseLiteralOr, type PyValue } from './python-literal.js';

/** Raw CSV row: every column arrives as a string. */
export type RawRow = Record<string, string>;

const isRecord = (v: PyValue): v is { [k: string]: PyValue } =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Trims, collapses whitespace, and maps empty/`None` placeholders to null. */
function str(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).replace(/\s+/g, ' ').trim();
  if (s === '' || s === 'None' || s === 'nan' || s === 'null') return null;
  return s;
}

function num(value: unknown): number | null {
  const s = str(value);
  if (s === null) return null;
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function bool(value: PyValue): boolean {
  return value === true || value === 'True' || value === 'true';
}

/** Lowercased, de-duplicated, order-preserving list of non-empty strings. */
function strList(value: PyValue): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    const s = str(item)?.toLowerCase();
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

function pick(obj: PyValue, key: string): PyValue {
  return isRecord(obj) ? (obj[key] ?? null) : null;
}

/**
 * Last line of defence against column drift.
 *
 * The source file shifts columns in ways the reader cannot always detect, so a
 * serialised blob or a salary range can land in a text field. These two guards
 * sit at the boundary of the domain model: whatever the reader produces, a
 * `Profile` never carries a JSON blob where a country name belongs.
 */
function label(value: unknown, maxLength = 120): string | null {
  const s = str(value);
  if (s === null || s.length > maxLength) return null;
  if (s.startsWith('[') || s.startsWith('{') || s.includes("':")) return null;
  // An industry, company, job title or country always contains a letter.
  // Requiring one rejects every non-name that column drift can deposit here:
  // phone numbers (`+15805831639`), salary ranges, postal codes, geo pairs, ids.
  if (!/\p{L}/u.test(s)) return null;
  return s;
}

/** A place name: letters, spaces and light punctuation only. */
function placeName(value: unknown): string | null {
  const s = label(value, 60);
  return s !== null && /^[\p{L}][\p{L} .'()/-]*$/u.test(s) ? s.toLowerCase() : null;
}

/** An experience with no end date is still running. */
function isCurrent(endDate: string | null, primary: boolean): boolean {
  return endDate === null && primary;
}

function toExperience(entry: PyValue): Experience {
  const company = pick(entry, 'company');
  const title = pick(entry, 'title');
  const endDate = str(pick(entry, 'end_date'));
  const primary = bool(pick(entry, 'is_primary'));
  const locations = strList(pick(entry, 'location_names'));
  return {
    title: str(pick(title, 'name')),
    role: str(pick(title, 'role')),
    subRole: str(pick(title, 'sub_role')),
    levels: strList(pick(title, 'levels')),
    company: str(pick(company, 'name')),
    companyIndustry: str(pick(company, 'industry')),
    locationName: locations[0] ?? str(pick(pick(company, 'location'), 'name')),
    startDate: str(pick(entry, 'start_date')),
    endDate,
    isPrimary: primary,
    isCurrent: isCurrent(endDate, primary),
    summary: str(pick(entry, 'summary')),
  };
}

function toEducation(entry: PyValue): Education {
  const school = pick(entry, 'school');
  return {
    school: str(pick(school, 'name')),
    schoolUrl: str(pick(school, 'linkedin_url')),
    locationName: str(pick(pick(school, 'location'), 'name')),
    degrees: strList(pick(entry, 'degrees')),
    majors: strList(pick(entry, 'majors')),
    minors: strList(pick(entry, 'minors')),
    gpa: str(pick(entry, 'gpa')),
    startDate: str(pick(entry, 'start_date')),
    endDate: str(pick(entry, 'end_date')),
  };
}

/** Newest-first by start date; entries without a date sink to the bottom. */
function byRecency<T extends { startDate: string | null }>(a: T, b: T): number {
  if (a.startDate === b.startDate) return 0;
  if (a.startDate === null) return 1;
  if (b.startDate === null) return -1;
  return b.startDate.localeCompare(a.startDate);
}

/**
 * Stable identifier. LinkedIn's numeric id is present for almost every row;
 * the username and a name slug are deterministic fallbacks, so re-running the
 * ETL always reproduces the same ids (and therefore the same shareable URLs).
 */
function profileId(row: RawRow, index: number): string {
  const linkedinId = str(row.linkedin_id);
  if (linkedinId) return `li-${linkedinId}`;
  const username = str(row.linkedin_username);
  if (username) return `un-${username.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
  const name = str(row.full_name) ?? 'profile';
  return `nm-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index}`;
}

function toLocation(row: RawRow): Location {
  const name = label(row.location_name, 120);
  return {
    name: name?.toLowerCase() ?? null,
    locality: placeName(row.location_locality),
    region: placeName(row.location_region),
    country: placeName(row.location_country),
    continent: placeName(row.location_continent),
  };
}

export interface NormalizeIssue {
  row: number;
  column: string;
  message: string;
}

/** Raw CSV row -> domain `Profile`. Recoverable parse problems land in `issues`. */
export function normalizeRow(row: RawRow, index: number, issues: NormalizeIssue[]): Profile {
  /**
   * Reads a Python-literal cell and guarantees an array back. A handful of rows
   * hold a scalar (or a truncated blob) where a list is expected; those become
   * an empty list plus a recorded issue instead of crashing the whole ingest.
   */
  const literal = (column: string): PyValue[] => {
    const value = parseLiteralOr(row[column], [], (err) =>
      issues.push({ row: index, column, message: err.message }),
    );
    if (Array.isArray(value)) return value;
    if (value !== null && value !== undefined && row[column]?.trim()) {
      issues.push({ row: index, column, message: `expected a list, got ${typeof value}` });
    }
    return [];
  };

  const experience = literal('experience').map(toExperience).sort(byRecency);
  const education = literal('education').map(toEducation).sort(byRecency);

  const certifications = literal('certifications')
    .map((c) => str(pick(c, 'name')))
    .filter((c): c is string => c !== null)
    .map((c) => c.toLowerCase());

  const languages = literal('languages')
    .map((l) => str(pick(l, 'name')))
    .filter((l): l is string => l !== null)
    .map((l) => l.toLowerCase());

  const currentTitle = label(row.job_title, 120)?.toLowerCase() ?? null;

  return {
    id: profileId(row, index),
    fullName: str(row.full_name) ?? 'unknown',
    firstName: str(row.first_name),
    lastName: str(row.last_name),
    gender: str(row.gender),
    linkedinUrl: str(row.linkedin_url),
    linkedinUsername: str(row.linkedin_username),
    githubUrl: str(row.github_url),
    twitterUrl: str(row.twitter_url),

    jobTitle: currentTitle,
    jobTitleRole: str(row.job_title_role),
    jobTitleSubRole: str(row.job_title_sub_role),
    jobTitleLevels: strList(literal('job_title_levels')),
    jobStartDate: str(row.job_start_date),
    industry: label(row.industry, 60)?.toLowerCase() ?? null,
    company: {
      name: label(row.job_company_name, 100)?.toLowerCase() ?? null,
      industry: label(row.job_company_industry, 60)?.toLowerCase() ?? null,
      size: str(row.job_company_size),
      website: str(row.job_company_website),
      linkedinUrl: str(row.job_company_linkedin_url),
    },

    location: toLocation(row),

    summary: str(row.summary),
    yearsExperience: num(row.inferred_years_experience),
    connections: num(row.linkedin_connections),
    inferredSalary: str(row.inferred_salary),

    skills: strList(literal('skills')),
    interests: strList(literal('interests')),
    languages,
    certifications,
    experience,
    education,
  };
}

/**
 * The text handed to the full-text index.
 *
 * Kept in one place so the SQLite and Elasticsearch adapters index exactly the
 * same content and a query behaves identically on both engines. Fields are
 * emitted as separate columns/properties so the engine can weight them
 * (a name hit must outrank a hit buried in a summary).
 */
export function toIndexDocument(p: Profile) {
  return {
    name: p.fullName,
    title: [p.jobTitle, p.jobTitleRole, p.jobTitleSubRole, ...p.jobTitleLevels]
      .filter(Boolean)
      .join(' '),
    company: [p.company.name, ...p.experience.map((e) => e.company)].filter(Boolean).join(' '),
    skills: p.skills.join(' '),
    education: p.education
      .flatMap((e) => [e.school, ...e.degrees, ...e.majors])
      .filter(Boolean)
      .join(' '),
    experience: p.experience
      .flatMap((e) => [e.title, e.company, e.role])
      .filter(Boolean)
      .join(' '),
    location: [p.location.name, p.location.country, p.location.region].filter(Boolean).join(' '),
    industry: [p.industry, p.company.industry].filter(Boolean).join(' '),
    summary: [p.summary, ...p.interests].filter(Boolean).join(' '),
  };
}
