import fs from 'node:fs';
import { parse } from 'csv-parse/sync';
import type { RawRow } from './normalize.js';
import { salvageRecord } from './salvage.js';

/**
 * Reader for the supplied dataset.
 *
 * The source file is not clean CSV, and pretending otherwise silently loses
 * ~16% of the profiles. Three defects, handled in order:
 *
 *  1. 58 grep-output lines were pasted into the file mid-record, e.g.
 *     `H:\New folder\…\part-00001.csv(2293): Specialties: …`.
 *     Each one breaks the record it landed in into fragments.
 *  2. The file is two exports concatenated, so the header row appears twice
 *     and 50 profiles are present in both halves.
 *  3. A few records lost a quote character, which splits their composite
 *     values on internal commas and shifts every later column.
 *
 * The pipeline below repairs (1), splits on record boundaries rather than
 * trusting line breaks, reads (3) structurally via `salvageRecord`, and
 * de-duplicates (2) — reporting every count so nothing is lost quietly.
 */

/** Grep-output prefix injected into the file, plus the line break it introduced. */
const WATERMARK = /\r?\n?H:\\New folder\\.*?\.csv\(\d+\):[ \t]?/g;

/**
 * Start of a record: `name,first,last,gender,linkedin.com/in/…`.
 * Field values may contain newlines, so record boundaries cannot be found by
 * splitting on "\n" — this anchor is what makes the fragments re-joinable.
 */
const RECORD_START =
  /^(?=[^,\n"]{2,60},[^,\n"]{0,40},[^,\n"]{0,40},(?:male|female|),linkedin\.com\/in\/)/gm;

const EXPECTED_COLUMNS = 77;

export interface DatasetReport {
  /** Injected grep-output lines removed. */
  watermarksRemoved: number;
  /** Record boundaries detected. */
  recordsFound: number;
  /** Records that parsed cleanly into 77 columns. */
  parsedPositionally: number;
  /** Records rebuilt by `salvageRecord`. */
  salvaged: number;
  /** Records that could not be read at all. */
  unrecoverable: number;
  /** Duplicate profiles (same LinkedIn id) collapsed into one. */
  duplicatesRemoved: number;
  /** Rows handed to the normaliser. */
  kept: number;
}

export interface DatasetResult {
  rows: RawRow[];
  report: DatasetReport;
}

export function readDataset(filePath: string): DatasetResult {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Dataset not found at ${filePath}\n` +
        `Set DATA_CSV in backend/.env, or place the CSV at data/linkedin_profiles.csv`,
    );
  }

  const raw = fs.readFileSync(filePath, 'utf8');

  // --- 1. strip the injected grep output ------------------------------------
  const watermarksRemoved = raw.match(WATERMARK)?.length ?? 0;
  const cleaned = raw.replace(WATERMARK, '');

  // --- header: taken from the first line, and reused for the second export ---
  const header = parse(cleaned.slice(0, cleaned.indexOf('\n')), {
    relax_quotes: true,
  })[0] as string[];

  // --- 2. cut into records on the anchor, not on line breaks ----------------
  const starts = [...cleaned.matchAll(RECORD_START)].map((m) => m.index!);
  const segments = starts.map((start, i) =>
    cleaned.slice(start, i + 1 < starts.length ? starts[i + 1] : cleaned.length),
  );

  const report: DatasetReport = {
    watermarksRemoved,
    recordsFound: segments.length,
    parsedPositionally: 0,
    salvaged: 0,
    unrecoverable: 0,
    duplicatesRemoved: 0,
    kept: 0,
  };

  const rows: RawRow[] = [];
  for (const segment of segments) {
    const flat = flatten(segment);

    if (flat.length === EXPECTED_COLUMNS) {
      const row = toRow(header, flat);
      // A correct field *count* does not prove correct field *alignment*: some
      // records drop one column and gain another further along, landing back on
      // 77 while every value in between sits one slot to the left. So the
      // mapping is verified against the shape of the values themselves.
      if (isAligned(row)) {
        rows.push(row);
        report.parsedPositionally += 1;
        continue;
      }
    }

    // --- 3. positional mapping is unusable; recover by structure ------------
    const recovered = salvageRecord(flat, segment);
    if (recovered) {
      rows.push(recovered);
      report.salvaged += 1;
    } else {
      report.unrecoverable += 1;
    }
  }

  const deduped = dedupe(rows);
  report.duplicatesRemoved = rows.length - deduped.length;
  report.kept = deduped.length;

  return { rows: deduped, report };
}

/**
 * Cheap structural check that a positionally-mapped row really lines up.
 *
 * Each assertion targets a column whose *shape* is known in advance, so a
 * one-slot shift shows up immediately: a list column holding prose, or an id
 * column holding a word.
 */
function isAligned(row: RawRow): boolean {
  const isListCell = (value: string | undefined): boolean => {
    const v = (value ?? '').trim();
    return v === '' || v.startsWith('[');
  };

  if (!isListCell(row.job_title_levels)) return false;
  if (!isListCell(row.skills)) return false;
  if (!isListCell(row.experience)) return false;
  if (!isListCell(row.education)) return false;
  if (!isListCell(row.interests)) return false;

  // Dict-shaped column: anything list-like here means the row slid sideways.
  const versionStatus = (row.version_status ?? '').trim();
  if (versionStatus !== '' && !versionStatus.startsWith('{')) return false;

  // LinkedIn's numeric id.
  const id = (row.linkedin_id ?? '').trim();
  if (id !== '' && !/^\d+$/.test(id)) return false;

  // The blob columns must carry their signature keys, not another column's.
  const experience = (row.experience ?? '').trim();
  if (experience.startsWith('[{') && !experience.includes("'company'")) return false;
  const education = (row.education ?? '').trim();
  if (education.startsWith('[{') && !education.includes("'school'")) return false;

  return true;
}

/**
 * Parses one record's text into a flat field list.
 * A damaged record can parse as several physical rows, so they are concatenated.
 */
function flatten(segment: string): string[] {
  try {
    const parsed = parse(segment, {
      relax_quotes: true,
      relax_column_count: true,
      skip_empty_lines: true,
      bom: true,
    }) as string[][];
    return parsed.flat();
  } catch {
    return [];
  }
}

function toRow(header: string[], fields: string[]): RawRow {
  const row: RawRow = {};
  header.forEach((column, i) => {
    row[column] = fields[i] ?? '';
  });
  return row;
}

/**
 * Collapses profiles that appear in both exports, keeping the richer copy —
 * a duplicate in the index would show the same person twice in every result.
 */
function dedupe(rows: RawRow[]): RawRow[] {
  const byId = new Map<string, RawRow>();
  const out: RawRow[] = [];

  for (const row of rows) {
    const key = (row.linkedin_id || row.linkedin_url || row.full_name || '').trim();
    if (!key) {
      out.push(row);
      continue;
    }
    const existing = byId.get(key);
    if (!existing || completeness(row) > completeness(existing)) {
      byId.set(key, row);
    }
  }

  return [...out, ...byId.values()];
}

/** Rough richness score: how much non-empty content the record carries. */
function completeness(row: RawRow): number {
  return Object.values(row).reduce((sum, value) => sum + (value ? value.length : 0), 0);
}
