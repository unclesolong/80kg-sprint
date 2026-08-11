import type { PlanAIOutput, WeeklyReviewAIOutput, FoodParseOutput } from './contracts'
import { z } from 'zod'

type JsonSchema = Record<string, unknown>

const aiCommentZodSchema = z.strictObject({
  title: z.string().min(1).max(40),
  summary: z.string().min(1).max(220),
  bullets: z.array(z.string().max(80)).max(4),
  tone: z.enum(['supportive', 'neutral', 'caution']),
})

const selectedTargetsZodSchema = z.strictObject({
  calorieTargetKcal: z.number(),
  proteinMinG: z.number(),
  proteinMaxG: z.number(),
  waterTargetMl: z.number(),
  expectedWeeklyLossKg: z.number(),
  aerobicMinutesPerWeek: z.number(),
  strengthDaysPerWeek: z.number(),
  eveningReserveKcal: z.number(),
})

const dailyEnergyPlanZodSchema = z.strictObject({
  restingEnergyKcal: z.number().min(500).max(5000),
  activeEnergyKcal: z.number().min(0).max(3000),
  estimatedTdeeKcal: z.number().min(800).max(7000),
  source: z.enum(['wearable_logs', 'profile_wearable_average', 'mifflin']),
  confidence: z.enum(['low', 'medium', 'high']),
  sampleCount: z.number().int().min(0).max(30),
})

export const planAIOutputZodSchema: z.ZodType<PlanAIOutput> = z.strictObject({
  schemaVersion: z.literal(1),
  status: z.enum(['ok', 'needs_more_data', 'restricted']),
  selectedTargets: selectedTargetsZodSchema,
  energyPlan: dailyEnergyPlanZodSchema,
  focusTasks: z.array(z.string().max(60)).max(4),
  comment: aiCommentZodSchema,
  assumptions: z.array(z.strictObject({
    code: z.string().min(1).max(48),
    text: z.string().min(1).max(100),
  })).max(8),
  warnings: z.array(z.strictObject({
    code: z.string().min(1).max(48),
    text: z.string().min(1).max(120),
  })).max(8),
})

export const weeklyReviewAIOutputZodSchema: z.ZodType<WeeklyReviewAIOutput> = z.strictObject({
  schemaVersion: z.literal(1),
  decision: z.enum([
    'maintain',
    'increase_calories',
    'decrease_calories',
    'improve_data_first',
    'recovery_priority',
    'restricted',
  ]),
  calorieAdjustmentKcal: z.union([
    z.literal(-150),
    z.literal(-100),
    z.literal(0),
    z.literal(100),
    z.literal(150),
  ]),
  activityAdjustment: z.strictObject({
    aerobicMinutesDelta: z.number().min(-30).max(30),
    strengthDaysDelta: z.number().min(-1).max(1),
  }),
  focusTasks: z.array(z.string().max(60)).max(4),
  comment: aiCommentZodSchema,
  warnings: z.array(z.string().max(120)).max(6),
})

export const foodParseOutputZodSchema: z.ZodType<FoodParseOutput> = z.strictObject({
  schemaVersion: z.literal(1),
  items: z.array(z.strictObject({
    rawText: z.string().min(1).max(100),
    normalizedName: z.string().min(1).max(100),
    amount: z.number().positive().nullable(),
    unit: z.enum(['g', 'ml', '份', '顆']).nullable(),
    preparation: z.string().max(60).nullable(),
    weightState: z.enum(['raw', 'cooked', 'unknown']),
    brand: z.string().max(80).nullable(),
    searchTerms: z.array(z.string().max(80)).max(5),
    needsConfirmation: z.boolean(),
    confirmationQuestion: z.string().max(120).nullable(),
  })).max(20),
  unparsedText: z.array(z.string().max(100)).max(10),
})

const commentSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'summary', 'bullets', 'tone'],
  properties: {
    title: { type: 'string', maxLength: 40 },
    summary: { type: 'string', maxLength: 220 },
    bullets: { type: 'array', maxItems: 4, items: { type: 'string', maxLength: 80 } },
    tone: { type: 'string', enum: ['supportive', 'neutral', 'caution'] },
  },
}

export const planAIOutputSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'schemaVersion',
    'status',
    'selectedTargets',
    'energyPlan',
    'focusTasks',
    'comment',
    'assumptions',
    'warnings',
  ],
  properties: {
    schemaVersion: { type: 'integer', const: 1 },
    status: { type: 'string', enum: ['ok', 'needs_more_data', 'restricted'] },
    selectedTargets: {
      type: 'object',
      additionalProperties: false,
      required: [
        'calorieTargetKcal',
        'proteinMinG',
        'proteinMaxG',
        'waterTargetMl',
        'expectedWeeklyLossKg',
        'aerobicMinutesPerWeek',
        'strengthDaysPerWeek',
        'eveningReserveKcal',
      ],
      properties: {
        calorieTargetKcal: { type: 'number' },
        proteinMinG: { type: 'number' },
        proteinMaxG: { type: 'number' },
        waterTargetMl: { type: 'number' },
        expectedWeeklyLossKg: { type: 'number' },
        aerobicMinutesPerWeek: { type: 'number' },
        strengthDaysPerWeek: { type: 'number' },
        eveningReserveKcal: { type: 'number' },
      },
    },
    energyPlan: {
      type: 'object',
      additionalProperties: false,
      required: ['restingEnergyKcal', 'activeEnergyKcal', 'estimatedTdeeKcal', 'source', 'confidence', 'sampleCount'],
      properties: {
        restingEnergyKcal: { type: 'number', minimum: 500, maximum: 5000 },
        activeEnergyKcal: { type: 'number', minimum: 0, maximum: 3000 },
        estimatedTdeeKcal: { type: 'number', minimum: 800, maximum: 7000 },
        source: { type: 'string', enum: ['wearable_logs', 'profile_wearable_average', 'mifflin'] },
        confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
        sampleCount: { type: 'integer', minimum: 0, maximum: 30 },
      },
    },
    focusTasks: { type: 'array', maxItems: 4, items: { type: 'string', maxLength: 60 } },
    comment: commentSchema,
    assumptions: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['code', 'text'],
        properties: {
          code: { type: 'string', maxLength: 48 },
          text: { type: 'string', maxLength: 100 },
        },
      },
    },
    warnings: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['code', 'text'],
        properties: {
          code: { type: 'string', maxLength: 48 },
          text: { type: 'string', maxLength: 120 },
        },
      },
    },
  },
}

export const weeklyReviewAIOutputSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'schemaVersion',
    'decision',
    'calorieAdjustmentKcal',
    'activityAdjustment',
    'focusTasks',
    'comment',
    'warnings',
  ],
  properties: {
    schemaVersion: { type: 'integer', const: 1 },
    decision: {
      type: 'string',
      enum: [
        'maintain',
        'increase_calories',
        'decrease_calories',
        'improve_data_first',
        'recovery_priority',
        'restricted',
      ],
    },
    calorieAdjustmentKcal: { type: 'integer', enum: [-150, -100, 0, 100, 150] },
    activityAdjustment: {
      type: 'object',
      additionalProperties: false,
      required: ['aerobicMinutesDelta', 'strengthDaysDelta'],
      properties: {
        aerobicMinutesDelta: { type: 'number', minimum: -30, maximum: 30 },
        strengthDaysDelta: { type: 'number', minimum: -1, maximum: 1 },
      },
    },
    focusTasks: { type: 'array', maxItems: 4, items: { type: 'string', maxLength: 60 } },
    comment: commentSchema,
    warnings: { type: 'array', maxItems: 6, items: { type: 'string', maxLength: 120 } },
  },
}

export const foodParseOutputSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'items', 'unparsedText'],
  properties: {
    schemaVersion: { type: 'integer', const: 1 },
    items: {
      type: 'array',
      maxItems: 20,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'rawText',
          'normalizedName',
          'amount',
          'unit',
          'preparation',
          'weightState',
          'brand',
          'searchTerms',
          'needsConfirmation',
          'confirmationQuestion',
        ],
        properties: {
          rawText: { type: 'string', maxLength: 100 },
          normalizedName: { type: 'string', maxLength: 100 },
          amount: { anyOf: [{ type: 'number', exclusiveMinimum: 0 }, { type: 'null' }] },
          unit: { anyOf: [{ type: 'string', enum: ['g', 'ml', '份', '顆'] }, { type: 'null' }] },
          preparation: { anyOf: [{ type: 'string', maxLength: 60 }, { type: 'null' }] },
          weightState: { type: 'string', enum: ['raw', 'cooked', 'unknown'] },
          brand: { anyOf: [{ type: 'string', maxLength: 80 }, { type: 'null' }] },
          searchTerms: { type: 'array', maxItems: 5, items: { type: 'string', maxLength: 80 } },
          needsConfirmation: { type: 'boolean' },
          confirmationQuestion: { anyOf: [{ type: 'string', maxLength: 120 }, { type: 'null' }] },
        },
      },
    },
    unparsedText: { type: 'array', maxItems: 10, items: { type: 'string', maxLength: 100 } },
  },
}

export const structuredOutputDefinitions: Record<
  'plan' | 'weekly_review' | 'food_parse',
  { name: string; schema: JsonSchema }
> = {
  plan: { name: 'fat_loss_plan', schema: planAIOutputSchema },
  weekly_review: { name: 'weekly_review', schema: weeklyReviewAIOutputSchema },
  food_parse: { name: 'food_parse', schema: foodParseOutputSchema },
}

// Compile-time checks keep schema-facing TypeScript contracts reachable in this module.
export type StructuredOutput = PlanAIOutput | WeeklyReviewAIOutput | FoodParseOutput
