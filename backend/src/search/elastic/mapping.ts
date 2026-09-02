/**
 * Elasticsearch index definition.
 *
 * The analysed fields mirror `toIndexDocument()` one-for-one so a query returns
 * the same documents on either engine. Each also carries a `kw` keyword
 * sub-field: analysed text is for *matching*, keyword is for *filtering and
 * aggregating* (facet counts) — mixing the two is the classic ES mistake.
 */
export const INDEX_SETTINGS = {
  settings: {
    number_of_shards: 1,
    number_of_replicas: 0,
    analysis: {
      analyzer: {
        // Lowercase + ASCII-fold, matching SQLite's `remove_diacritics 2`.
        folding: {
          tokenizer: 'standard',
          filter: ['lowercase', 'asciifolding'],
        },
      },
    },
  },
  mappings: {
    properties: {
      name: { type: 'text', analyzer: 'folding', fields: { kw: { type: 'keyword' } } },
      title: { type: 'text', analyzer: 'folding', fields: { kw: { type: 'keyword' } } },
      company: { type: 'text', analyzer: 'folding', fields: { kw: { type: 'keyword' } } },
      skills: { type: 'text', analyzer: 'folding', fields: { kw: { type: 'keyword' } } },
      education: { type: 'text', analyzer: 'folding' },
      experience: { type: 'text', analyzer: 'folding' },
      location: { type: 'text', analyzer: 'folding' },
      industry: { type: 'text', analyzer: 'folding', fields: { kw: { type: 'keyword' } } },
      summary: { type: 'text', analyzer: 'folding' },

      // Filter-only fields (never analysed).
      skillList: { type: 'keyword' },
      jobTitle: { type: 'keyword' },
      companyName: { type: 'keyword' },
      industryName: { type: 'keyword' },
      country: { type: 'keyword' },
      levels: { type: 'keyword' },
      degrees: { type: 'keyword' },
      schools: { type: 'keyword' },
      companies: { type: 'keyword' },

      // Sort / range fields.
      yearsExperience: { type: 'float' },
      connections: { type: 'integer' },
      skillCount: { type: 'integer' },
      fullNameSort: { type: 'keyword' },

      // Stored verbatim for the detail endpoint, excluded from the index.
      document: { type: 'object', enabled: false },
    },
  },
} as const;

/** Field boosts for `multi_match`, mirroring the SQLite BM25 weights. */
export const FIELD_BOOSTS = [
  'name^10',
  'title^8',
  'skills^6',
  'company^4',
  'education^3',
  'experience^3',
  'location^2',
  'industry^2',
  'summary^1',
];
