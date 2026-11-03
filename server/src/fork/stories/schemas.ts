import { AllowedSchema } from 'express-json-validator-middleware'
import { JSONSchema7 } from 'json-schema'

export const CONSENT_METHODS = [
  'signed_form',
  'recorded_statement',
  'verbal',
  'family_or_community',
  'other',
] as const

export const RECORDING_LANGUAGES = ['ain', 'ja'] as const

const nullableString = (maxLength: number): JSONSchema7 => ({
  type: ['string', 'null'],
  maxLength,
})

// YYYY, YYYY-MM or YYYY-MM-DD: archived recordings are often only known to
// the year.
const partialDate: JSONSchema7 = {
  type: ['string', 'null'],
  pattern: '^[0-9]{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12][0-9]|3[01]))?)?$',
}

const speakerProperties: Record<string, JSONSchema7> = {
  display_name: { type: 'string', minLength: 1, maxLength: 255 },
  full_name: nullableString(255),
  birth_year: { type: ['integer', 'null'], minimum: 1850, maximum: 2100 },
  gender: nullableString(64),
  region: nullableString(255),
  notes: nullableString(5000),
}

export const CreateSpeakerRequest: AllowedSchema = {
  type: 'object',
  required: ['display_name'],
  additionalProperties: false,
  properties: {
    ...speakerProperties,
    // Create the speaker for the signed-in user themselves
    is_self: { type: 'boolean' },
  },
}

export const UpdateSpeakerRequest: AllowedSchema = {
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  properties: speakerProperties,
}

export const CreateConsentRequest: AllowedSchema = {
  type: 'object',
  required: [
    'archive',
    'community_use',
    'research',
    'speech_technology',
    'method',
  ],
  additionalProperties: false,
  properties: {
    archive: { type: 'boolean' },
    community_use: { type: 'boolean' },
    research: { type: 'boolean' },
    speech_technology: { type: 'boolean' },
    method: { type: 'string', enum: [...CONSENT_METHODS] },
    given_on: {
      type: ['string', 'null'],
      pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$',
    },
    notes: nullableString(5000),
  },
}

const recordingProperties: Record<string, JSONSchema7> = {
  title: { type: 'string', minLength: 1, maxLength: 255 },
  description: nullableString(10000),
  languages: {
    type: 'array',
    minItems: 1,
    uniqueItems: true,
    items: { type: 'string', enum: [...RECORDING_LANGUAGES] },
  },
  speaker_ids: {
    type: 'array',
    minItems: 1,
    maxItems: 20,
    uniqueItems: true,
    items: { type: 'integer', minimum: 1 },
  },
  recorded_on: partialDate,
  // Optional: many archived recordings have no known location
  location: nullableString(255),
}

export const CreateRecordingRequest: AllowedSchema = {
  type: 'object',
  required: ['title', 'languages', 'speaker_ids', 'source'],
  additionalProperties: false,
  properties: {
    ...recordingProperties,
    source: { type: 'string', enum: ['browser', 'upload'] },
    original_filename: nullableString(255),
    original_mime: nullableString(255),
  },
}

export const UpdateRecordingRequest: AllowedSchema = {
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  properties: recordingProperties,
}

export const CompleteRecordingRequest: AllowedSchema = {
  type: 'object',
  required: ['chunk_count'],
  additionalProperties: false,
  properties: {
    chunk_count: { type: 'integer', minimum: 1 },
  },
}
