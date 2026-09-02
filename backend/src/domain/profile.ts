/**
 * Domain model.
 *
 * The raw CSV has 77 flat columns with several cells holding Python-literal
 * blobs. Nothing outside `src/etl` is allowed to know that. Every layer above
 * the ETL works with the shapes below, so swapping the source file (or moving
 * to a different vendor export) only touches the ETL.
 */

export interface Company {
  name: string | null;
  industry: string | null;
  size: string | null;
  website: string | null;
  linkedinUrl: string | null;
}

export interface Experience {
  title: string | null;
  /** Normalised job family, e.g. "human_resources". */
  role: string | null;
  subRole: string | null;
  /** Seniority markers, e.g. ["manager"]. */
  levels: string[];
  company: string | null;
  companyIndustry: string | null;
  locationName: string | null;
  startDate: string | null;
  endDate: string | null;
  isPrimary: boolean;
  isCurrent: boolean;
  summary: string | null;
}

export interface Education {
  school: string | null;
  schoolUrl: string | null;
  locationName: string | null;
  degrees: string[];
  majors: string[];
  minors: string[];
  gpa: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface Location {
  name: string | null;
  locality: string | null;
  region: string | null;
  country: string | null;
  continent: string | null;
}

/** A single, fully normalised LinkedIn profile. */
export interface Profile {
  /** Stable id: the LinkedIn id when present, otherwise a slug of the URL/name. */
  id: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  gender: string | null;
  linkedinUrl: string | null;
  linkedinUsername: string | null;
  githubUrl: string | null;
  twitterUrl: string | null;

  /** Current position. */
  jobTitle: string | null;
  jobTitleRole: string | null;
  jobTitleSubRole: string | null;
  /** Seniority levels of the current title, e.g. ["senior", "manager"]. */
  jobTitleLevels: string[];
  jobStartDate: string | null;
  industry: string | null;
  company: Company;

  location: Location;

  summary: string | null;
  yearsExperience: number | null;
  connections: number | null;
  inferredSalary: string | null;

  skills: string[];
  interests: string[];
  languages: string[];
  certifications: string[];
  experience: Experience[];
  education: Education[];
}

/** A trimmed profile as returned by the search endpoint (list view). */
export interface ProfileSummary {
  id: string;
  fullName: string;
  jobTitle: string | null;
  company: string | null;
  industry: string | null;
  locationName: string | null;
  country: string | null;
  yearsExperience: number | null;
  connections: number | null;
  linkedinUrl: string | null;
  jobTitleLevels: string[];
  /** Capped in the list view; the full list lives on the detail endpoint. */
  skills: string[];
  skillCount: number;
  topSchool: string | null;
  topDegree: string | null;
  summary: string | null;
  /** Engine relevance score. `null` when the result set is not keyword-ranked. */
  score: number | null;
  /** `<mark>`-annotated snippet around the keyword hit, when the engine can build one. */
  highlight: string | null;
}
