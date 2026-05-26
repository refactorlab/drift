// JSON Schema + TypeScript types for the AI suggestion envelope.
//
// The schema is exported as a constant (for ajv-backed tests at the
// boundary) AND mirrored as a TS type (for the hot path). Runtime
// validation is hand-written below — keeping ajv out of the bundle —
// but a CI test compiles this same schema and verifies the fixtures
// conform, so the two never drift.

export const AI_SUGGESTION_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://drift.refactorlab.dev/schemas/ai-suggestion-envelope.json',
  title: 'DriftAISuggestionEnvelope',
  type: 'object',
  required: ['suggestions'],
  additionalProperties: false,
  properties: {
    suggestions: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        required: [
          'file',
          'line',
          'category',
          'confidence',
          'why_it_matters',
          'references',
          'after_code',
        ],
        additionalProperties: false,
        properties: {
          file: { type: 'string', minLength: 1 },
          line: { type: 'integer', minimum: 1 },
          start_line: { type: 'integer', minimum: 1 },
          category: { type: 'string', enum: ['A', 'B', 'C'] },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          why_it_matters: { type: 'string', minLength: 10 },
          references: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['url'],
              additionalProperties: false,
              properties: {
                url: { type: 'string', format: 'uri', minLength: 1 },
                title: { type: 'string' },
              },
            },
          },
          after_code: { type: 'string', minLength: 1 },
        },
      },
    },
  },
} as const;

export type AISuggestionReference = {
  url: string;
  title?: string;
};

export type AISuggestion = {
  file: string;
  line: number;
  start_line?: number;
  category: 'A' | 'B' | 'C';
  confidence: number;
  why_it_matters: string;
  references: AISuggestionReference[];
  after_code: string;
};

export type AISuggestionEnvelope = {
  suggestions: AISuggestion[];
};

export const AI_QUALITY_BAR = {
  minConfidence: 0.75,
  validCategories: new Set<'A' | 'B' | 'C'>(['A', 'B', 'C']),
} as const;

export function passesAIQualityBar(s: AISuggestion): boolean {
  if (!AI_QUALITY_BAR.validCategories.has(s.category)) return false;
  if (s.confidence < AI_QUALITY_BAR.minConfidence) return false;
  if (!s.references.length || !s.references[0].url) return false;
  return true;
}
