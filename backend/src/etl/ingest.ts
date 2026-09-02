/**
 * ETL entry point — `npm run ingest`
 *
 *   CSV  ->  normalise  ->  SQLite tables + FTS5 index  [ -> Elasticsearch ]
 *
 * Idempotent: the schema is dropped and rebuilt on every run, and profile ids
 * are derived deterministically, so re-running always produces the same DB.
 *
 * Flags:
 *   --elastic   also (re)build the Elasticsearch index
 *   --only-elastic   skip SQLite, only rebuild the Elasticsearch index
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { config } from '../config.js';
import type { Profile } from '../domain/profile.js';
import { readDataset, type DatasetReport } from './dataset-reader.js';
import { normalizeRow, toIndexDocument, type NormalizeIssue } from './normalize.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.resolve(here, '../search/sqlite/schema.sql');

/** Reads, repairs and normalises the whole dataset (a few hundred rows). */
export function loadProfiles(csvPath: string): {
  profiles: Profile[];
  issues: NormalizeIssue[];
  report: DatasetReport;
} {
  const { rows, report } = readDataset(csvPath);

  const profiles: Profile[] = [];
  const issues: NormalizeIssue[] = [];
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    const profile = normalizeRow(row, index, issues);
    // The reader already de-duplicates by LinkedIn id; this is a last guard so
    // the primary key can never collide.
    if (seen.has(profile.id)) profile.id = `${profile.id}-${index}`;
    seen.add(profile.id);
    profiles.push(profile);
  });

  return { profiles, issues, report };
}

export function buildSqlite(profiles: Profile[], dbPath: string): void {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  // Remove the previous build entirely (plus its WAL sidecars) for a clean slate.
  for (const suffix of ['', '-wal', '-shm']) {
    if (fs.existsSync(dbPath + suffix)) fs.rmSync(dbPath + suffix);
  }

  const db = new Database(dbPath);
  db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));

  const insertProfile = db.prepare(`
    INSERT INTO profiles (
      id, full_name, first_name, last_name, gender,
      linkedin_url, linkedin_username, github_url, twitter_url,
      job_title, job_title_role, job_title_sub_role, job_start_date, industry,
      company_name, company_industry, company_size,
      location_name, location_locality, location_region, location_country, location_continent,
      summary, years_experience, connections, inferred_salary,
      skill_count, top_school, top_degree, document
    ) VALUES (
      @id, @full_name, @first_name, @last_name, @gender,
      @linkedin_url, @linkedin_username, @github_url, @twitter_url,
      @job_title, @job_title_role, @job_title_sub_role, @job_start_date, @industry,
      @company_name, @company_industry, @company_size,
      @location_name, @location_locality, @location_region, @location_country, @location_continent,
      @summary, @years_experience, @connections, @inferred_salary,
      @skill_count, @top_school, @top_degree, @document
    )
  `);

  const insertSkill = db.prepare(`INSERT OR IGNORE INTO skills (name) VALUES (?)`);
  const selectSkillId = db.prepare(`SELECT id FROM skills WHERE name = ?`);
  const linkSkill = db.prepare(
    `INSERT OR IGNORE INTO profile_skills (profile_id, skill_id) VALUES (?, ?)`,
  );
  const insertLevel = db.prepare(
    `INSERT OR IGNORE INTO profile_levels (profile_id, level) VALUES (?, ?)`,
  );
  const insertDegree = db.prepare(
    `INSERT OR IGNORE INTO profile_degrees (profile_id, degree) VALUES (?, ?)`,
  );
  const insertExperience = db.prepare(`
    INSERT INTO experiences
      (profile_id, title, role, company, company_industry, location_name, start_date, end_date, is_primary, is_current)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertEducation = db.prepare(`
    INSERT INTO educations (profile_id, school, degrees, majors, start_date, end_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertFts = db.prepare(`
    INSERT INTO profiles_fts
      (profile_id, name, title, company, skills, education, experience, location, industry, summary)
    VALUES (@profile_id, @name, @title, @company, @skills, @education, @experience, @location, @industry, @summary)
  `);

  const skillIdCache = new Map<string, number>();
  const skillId = (name: string): number => {
    const cached = skillIdCache.get(name);
    if (cached !== undefined) return cached;
    insertSkill.run(name);
    const row = selectSkillId.get(name) as { id: number };
    skillIdCache.set(name, row.id);
    return row.id;
  };

  // One transaction for the whole load: ~336 profiles x N children is thousands
  // of statements, and committing per-statement would be orders of magnitude slower.
  const run = db.transaction((batch: Profile[]) => {
    for (const p of batch) {
      const topEducation = p.education[0];
      insertProfile.run({
        id: p.id,
        full_name: p.fullName,
        first_name: p.firstName,
        last_name: p.lastName,
        gender: p.gender,
        linkedin_url: p.linkedinUrl,
        linkedin_username: p.linkedinUsername,
        github_url: p.githubUrl,
        twitter_url: p.twitterUrl,
        job_title: p.jobTitle,
        job_title_role: p.jobTitleRole,
        job_title_sub_role: p.jobTitleSubRole,
        job_start_date: p.jobStartDate,
        industry: p.industry,
        company_name: p.company.name,
        company_industry: p.company.industry,
        company_size: p.company.size,
        location_name: p.location.name,
        location_locality: p.location.locality,
        location_region: p.location.region,
        location_country: p.location.country,
        location_continent: p.location.continent,
        summary: p.summary,
        years_experience: p.yearsExperience,
        connections: p.connections,
        inferred_salary: p.inferredSalary,
        skill_count: p.skills.length,
        top_school: topEducation?.school ?? null,
        top_degree: topEducation?.degrees[0] ?? null,
        document: JSON.stringify(p),
      });

      for (const skill of p.skills) linkSkill.run(p.id, skillId(skill));
      for (const level of p.jobTitleLevels) insertLevel.run(p.id, level);

      const degrees = new Set(p.education.flatMap((e) => e.degrees));
      for (const degree of degrees) insertDegree.run(p.id, degree);

      for (const e of p.experience) {
        insertExperience.run(
          p.id,
          e.title,
          e.role,
          e.company,
          e.companyIndustry,
          e.locationName,
          e.startDate,
          e.endDate,
          e.isPrimary ? 1 : 0,
          e.isCurrent ? 1 : 0,
        );
      }

      for (const e of p.education) {
        insertEducation.run(
          p.id,
          e.school,
          JSON.stringify(e.degrees),
          JSON.stringify(e.majors),
          e.startDate,
          e.endDate,
        );
      }

      insertFts.run({ profile_id: p.id, ...toIndexDocument(p) });
    }
  });

  run(profiles);

  // Merge the FTS b-tree into fewer, larger segments so queries touch less disk.
  db.exec(`INSERT INTO profiles_fts(profiles_fts) VALUES('optimize')`);
  db.exec(`ANALYZE`);
  db.close();
}

async function buildElastic(profiles: Profile[]): Promise<void> {
  const { rebuildElasticIndex } = await import('../search/elastic/elastic.engine.js');
  await rebuildElasticIndex(profiles);
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const wantElastic = args.has('--elastic') || args.has('--only-elastic') || config.engine === 'elastic';
  const wantSqlite = !args.has('--only-elastic');

  const started = Date.now();

  // Prefer the real dataset; fall back to the committed synthetic sample so a
  // fresh clone works with no extra steps.
  let csvPath = config.csvPath;
  if (!fs.existsSync(csvPath) && fs.existsSync(config.sampleCsvPath)) {
    csvPath = config.sampleCsvPath;
    console.log(`ℹ no dataset at ${config.csvPath}`);
    console.log(`  falling back to the synthetic sample. To use the real one,`);
    console.log(`  drop it in as data/linkedin_profiles.csv and re-run.\n`);
  }

  console.log(`▸ reading  ${csvPath}`);
  const { profiles, issues, report } = loadProfiles(csvPath);

  console.log(`  ├─ injected grep lines removed  ${report.watermarksRemoved}`);
  console.log(`  ├─ records found                ${report.recordsFound}`);
  console.log(`  ├─ parsed positionally          ${report.parsedPositionally}`);
  console.log(`  ├─ recovered structurally       ${report.salvaged}`);
  console.log(`  ├─ unrecoverable                ${report.unrecoverable}`);
  console.log(`  ├─ duplicates collapsed         ${report.duplicatesRemoved}`);
  console.log(`  └─ unique profiles              ${report.kept}  (${Date.now() - started}ms)`);

  if (issues.length > 0) {
    console.warn(`  ⚠ ${issues.length} cell(s) could not be parsed and defaulted to empty`);
    for (const issue of issues.slice(0, 3)) {
      console.warn(`    row ${issue.row} · ${issue.column}: ${issue.message}`);
    }
    if (issues.length > 3) console.warn(`    …and ${issues.length - 3} more`);
  }

  if (wantSqlite) {
    const t = Date.now();
    buildSqlite(profiles, config.sqlitePath);
    console.log(`▸ sqlite   ${config.sqlitePath} (${Date.now() - t}ms)`);
  }

  if (wantElastic) {
    const t = Date.now();
    try {
      await buildElastic(profiles);
      console.log(`▸ elastic  index "${config.elastic.index}" (${Date.now() - t}ms)`);
    } catch (err) {
      console.error(`✗ elastic  ${(err as Error).message}`);
      console.error(`  Start it with "npm run es:up" from the repo root, then re-run.`);
      if (config.engine === 'elastic') process.exitCode = 1;
    }
  }

  const totalSkills = new Set(profiles.flatMap((p) => p.skills)).size;
  console.log(
    `✓ done in ${Date.now() - started}ms — ${profiles.length} profiles, ${totalSkills} distinct skills`,
  );
}

// Only run when invoked directly, so tests can import loadProfiles/buildSqlite.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('ingest.ts')) {
  main().catch((err) => {
    console.error(`✗ ingest failed: ${(err as Error).message}`);
    process.exit(1);
  });
}
