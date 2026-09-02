-- =============================================================================
-- task — storage schema (SQLite)
-- =============================================================================
-- Design notes
--
-- 1. `profiles` holds the scalar, single-valued attributes. Everything the API
--    can filter or sort on is a real column with a real index — no scanning
--    JSON at query time.
--
-- 2. Multi-valued attributes (skills, seniority levels, degrees) are normalised
--    into link tables. A skill filter is then an indexed join, and facet counts
--    are a GROUP BY instead of 336 array scans.
--
-- 3. `profiles.document` keeps the complete domain object as JSON. The detail
--    endpoint is a single primary-key lookup, and the ETL stays the only place
--    that knows the original CSV shape.
--
-- 4. `profiles_fts` is an FTS5 inverted index. Keyword search hits the index,
--    not the table, and BM25 ranks the result. Per-column weights let a name
--    hit outrank the same word buried in a summary.
-- =============================================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS profiles_fts;
DROP TABLE IF EXISTS profile_skills;
DROP TABLE IF EXISTS profile_levels;
DROP TABLE IF EXISTS profile_degrees;
DROP TABLE IF EXISTS experiences;
DROP TABLE IF EXISTS educations;
DROP TABLE IF EXISTS skills;
DROP TABLE IF EXISTS profiles;

-- -----------------------------------------------------------------------------
-- Core entity
-- -----------------------------------------------------------------------------
CREATE TABLE profiles (
  id                   TEXT PRIMARY KEY,
  full_name            TEXT    NOT NULL,
  first_name           TEXT,
  last_name            TEXT,
  gender               TEXT,
  linkedin_url         TEXT,
  linkedin_username    TEXT,
  github_url           TEXT,
  twitter_url          TEXT,

  job_title            TEXT,
  job_title_role       TEXT,
  job_title_sub_role   TEXT,
  job_start_date       TEXT,
  industry             TEXT,

  company_name         TEXT,
  company_industry     TEXT,
  company_size         TEXT,

  location_name        TEXT,
  location_locality    TEXT,
  location_region      TEXT,
  location_country     TEXT,
  location_continent   TEXT,

  summary              TEXT,
  years_experience     REAL,
  connections          INTEGER,
  inferred_salary      TEXT,

  -- Denormalised for the list view, so rendering a page of results never has
  -- to open the JSON document.
  skill_count          INTEGER NOT NULL DEFAULT 0,
  top_school           TEXT,
  top_degree           TEXT,

  -- Complete domain object (JSON) for GET /api/profiles/:id
  document             TEXT    NOT NULL
);

CREATE INDEX idx_profiles_job_title   ON profiles (job_title);
CREATE INDEX idx_profiles_company     ON profiles (company_name);
CREATE INDEX idx_profiles_industry    ON profiles (industry);
CREATE INDEX idx_profiles_country     ON profiles (location_country);
CREATE INDEX idx_profiles_years       ON profiles (years_experience);
CREATE INDEX idx_profiles_connections ON profiles (connections);
CREATE INDEX idx_profiles_name        ON profiles (full_name);

-- -----------------------------------------------------------------------------
-- Multi-valued attributes
-- -----------------------------------------------------------------------------
CREATE TABLE skills (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE profile_skills (
  profile_id TEXT    NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  skill_id   INTEGER NOT NULL REFERENCES skills (id)   ON DELETE CASCADE,
  PRIMARY KEY (profile_id, skill_id)
);
-- Reverse index: "who has skill X" without touching `profiles`.
CREATE INDEX idx_profile_skills_skill ON profile_skills (skill_id, profile_id);

CREATE TABLE profile_levels (
  profile_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  level      TEXT NOT NULL,
  PRIMARY KEY (profile_id, level)
);
CREATE INDEX idx_profile_levels_level ON profile_levels (level, profile_id);

CREATE TABLE profile_degrees (
  profile_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  degree     TEXT NOT NULL,
  PRIMARY KEY (profile_id, degree)
);
CREATE INDEX idx_profile_degrees_degree ON profile_degrees (degree, profile_id);

-- -----------------------------------------------------------------------------
-- History tables (one row per position / per school)
-- -----------------------------------------------------------------------------
CREATE TABLE experiences (
  id               INTEGER PRIMARY KEY,
  profile_id       TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  title            TEXT,
  role             TEXT,
  company          TEXT,
  company_industry TEXT,
  location_name    TEXT,
  start_date       TEXT,
  end_date         TEXT,
  is_primary       INTEGER NOT NULL DEFAULT 0,
  is_current       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_experiences_profile ON experiences (profile_id);
CREATE INDEX idx_experiences_company ON experiences (company);
CREATE INDEX idx_experiences_title   ON experiences (title);

CREATE TABLE educations (
  id         INTEGER PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  school     TEXT,
  degrees    TEXT,  -- JSON array
  majors     TEXT,  -- JSON array
  start_date TEXT,
  end_date   TEXT
);
CREATE INDEX idx_educations_profile ON educations (profile_id);
CREATE INDEX idx_educations_school  ON educations (school);

-- -----------------------------------------------------------------------------
-- Full-text index
-- -----------------------------------------------------------------------------
-- `prefix='2 3 4'` materialises 2/3/4-character prefix tokens so as-you-type
-- queries ("engin" -> "engineer") stay index-backed instead of degrading to a
-- table scan. `remove_diacritics 2` folds accents, so "jose" matches "josé".
CREATE VIRTUAL TABLE profiles_fts USING fts5 (
  profile_id UNINDEXED,
  name,
  title,
  company,
  skills,
  education,
  experience,
  location,
  industry,
  summary,
  tokenize = 'unicode61 remove_diacritics 2',
  prefix   = '2 3 4'
);
