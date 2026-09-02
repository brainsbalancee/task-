/** Response shapes returned by the backend. Mirrors `backend/src/domain`. */

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
  skills: string[];
  skillCount: number;
  topSchool: string | null;
  topDegree: string | null;
  summary: string | null;
  score: number | null;
  /** Contains `<mark>` tags produced by the search engine. */
  highlight: string | null;
}

export interface Experience {
  title: string | null;
  role: string | null;
  subRole: string | null;
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

export interface Profile extends Omit<ProfileSummary, 'score' | 'highlight' | 'company' | 'skillCount' | 'topSchool' | 'topDegree'> {
  firstName: string | null;
  lastName: string | null;
  gender: string | null;
  linkedinUsername: string | null;
  githubUrl: string | null;
  twitterUrl: string | null;
  jobTitleRole: string | null;
  jobTitleSubRole: string | null;
  jobStartDate: string | null;
  company: {
    name: string | null;
    industry: string | null;
    size: string | null;
    website: string | null;
    linkedinUrl: string | null;
  };
  location: {
    name: string | null;
    locality: string | null;
    region: string | null;
    country: string | null;
    continent: string | null;
  };
  inferredSalary: string | null;
  interests: string[];
  languages: string[];
  certifications: string[];
  experience: Experience[];
  education: Education[];
}

export interface SearchMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
  tookMs: number;
  engine: string;
  /** Present only when the request asked for `explain`. */
  explain?: SearchExplain;
}

/** Execution trace returned by `?explain=1`. */
export interface SearchExplain {
  engine: string;
  keyword: { input: string; parsed: string | null; note: string } | null;
  ranking: { function: string; note: string; weights?: { field: string; weight: number }[] };
  filters: { field: string; values: unknown[]; predicate: string }[];
  filterLogic: string;
  sort: string;
  query: string;
}

export interface Suggestion {
  value: string;
  type: 'skill' | 'title' | 'company' | 'name';
  count: number;
}

export interface SearchResponse {
  data: ProfileSummary[];
  meta: SearchMeta;
}

export interface FacetValue {
  value: string;
  count: number;
}

export interface DatasetStats {
  profiles: number;
  skills: number;
  companies: number;
  countries: number;
  experiences: number;
  educations: number;
  engine: string;
}

export type SortKey =
  | 'relevance'
  | 'experience_desc'
  | 'experience_asc'
  | 'connections_desc'
  | 'name_asc';

export type FacetField =
  | 'skills'
  | 'jobTitle'
  | 'company'
  | 'industry'
  | 'country'
  | 'level'
  | 'degree'
  | 'school';

/** Every filter the UI can apply. Mirrors the API's query parameters. */
export interface Filters {
  skill: string[];
  title: string[];
  company: string[];
  industry: string[];
  country: string[];
  level: string[];
  degree: string[];
  school: string[];
  minExp: string;
  maxExp: string;
}

export const EMPTY_FILTERS: Filters = {
  skill: [],
  title: [],
  company: [],
  industry: [],
  country: [],
  level: [],
  degree: [],
  school: [],
  minExp: '',
  maxExp: '',
};

export interface SearchParams {
  q: string;
  filters: Filters;
  skillMatch: 'any' | 'all';
  sort: SortKey;
  page: number;
  limit: number;
  /**
   * Ask the API for its execution trace. Off by default server-side so the
   * endpoint stays lean; this UI opts in to power the "how was this ranked?"
   * panel.
   */
  explain: boolean;
}
