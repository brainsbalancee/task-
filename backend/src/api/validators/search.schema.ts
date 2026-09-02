import { z } from 'zod';
import { config } from '../../config.js';
import type { FacetField, SearchQuery } from '../../search/engine.js';

/**
 * Request validation.
 *
 * Every query string reaching a controller has already passed through here, so
 * controllers work with a typed, bounded `SearchQuery` and never guard input
 * themselves. Invalid requests fail with 400 + a field-level error list.
 */

/** `?skill=go&skill=rust` and `?skill=go,rust` both produce ["go", "rust"]. */
const csvArray = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value): string[] => {
    if (value === undefined) return [];
    const parts = Array.isArray(value) ? value : [value];
    return parts
      .flatMap((p) => p.split(','))
      .map((p) => p.trim().toLowerCase())
      .filter((p) => p.length > 0)
      .slice(0, 25); // cap: keeps the generated SQL bounded
  });

const optionalNumber = z
  .string()
  .optional()
  .transform((v, ctx): number | null => {
    if (v === undefined || v.trim() === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'must be a number' });
      return null;
    }
    return n;
  });

export const sortKeys = [
  'relevance',
  'experience_desc',
  'experience_asc',
  'connections_desc',
  'name_asc',
] as const;

export const facetFields = [
  'skills',
  'jobTitle',
  'company',
  'industry',
  'country',
  'level',
  'degree',
  'school',
] as const satisfies readonly FacetField[];

export const searchQuerySchema = z
  .object({
    q: z.string().trim().max(200).optional(),

    // Filters
    skill: csvArray,
    title: csvArray,
    company: csvArray,
    industry: csvArray,
    country: csvArray,
    level: csvArray,
    degree: csvArray,
    school: csvArray,
    minExp: optionalNumber,
    maxExp: optionalNumber,

    skillMatch: z.enum(['any', 'all']).default('any'),
    // `?explain=1` / `?explain=true` attaches the execution trace.
    explain: z
      .union([z.literal('1'), z.literal('true'), z.literal('0'), z.literal('false')])
      .optional()
      .transform((v) => v === '1' || v === 'true'),
    sort: z.enum(sortKeys).default('relevance'),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(config.maxPageSize).default(20),
  })
  .superRefine((v, ctx) => {
    if (v.minExp !== null && v.maxExp !== null && v.minExp > v.maxExp) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minExp'],
        message: 'minExp cannot be greater than maxExp',
      });
    }
  })
  .transform(
    (v): SearchQuery => ({
      q: v.q && v.q.length > 0 ? v.q : null,
      filters: {
        skills: v.skill,
        jobTitle: v.title,
        company: v.company,
        industry: v.industry,
        country: v.country,
        level: v.level,
        degree: v.degree,
        school: v.school,
        minExperience: v.minExp,
        maxExperience: v.maxExp,
      },
      skillMatch: v.skillMatch,
      sort: v.sort,
      page: v.page,
      limit: v.limit,
      explain: v.explain,
    }),
  );

export const facetQuerySchema = z.object({
  field: z.enum(facetFields),
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

export const profileParamsSchema = z.object({
  id: z.string().trim().min(1).max(120),
});

export const suggestQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});
