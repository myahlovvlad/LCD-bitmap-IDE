/**
 * @module entities/screen/schema
 * @description Zod validation for portable LCD screen payloads and in-app
 * canvas data. Imported JSON is validated before it can mutate project state.
 */

import { z } from 'zod';
import { SCREEN_H, SCREEN_W } from '../../shared/constants/display';

const objectBaseSchema = z.object({
  id: z.string().min(1).max(128),
  zIndex: z.number().int().min(0).max(10000),
  visible: z.boolean(),
  locked: z.boolean(),
  source: z.enum(['fsm-lcd-import', 'user', 'prototype', 'generated'])
});

export const localizedTextSchema = z.object({
  en: z.string().max(2048),
  ru: z.string().max(2048),
  zh: z.string().max(2048).optional()
});

export const displayObjectSchema = z.discriminatedUnion('type', [
  objectBaseSchema.extend({
    type: z.literal('text'),
    text: localizedTextSchema,
    x: z.number().int(),
    y: z.number().int(),
    fontVariant: z.enum(['1', '2']),
    pendingTranslation: z.boolean()
  }),
  objectBaseSchema.extend({
    type: z.literal('line'),
    x0: z.number().int(),
    y0: z.number().int(),
    x1: z.number().int(),
    y1: z.number().int()
  }),
  objectBaseSchema.extend({
    type: z.literal('rect'),
    x: z.number().int(),
    y: z.number().int(),
    width: z.number().int().min(1).max(512),
    height: z.number().int().min(1).max(512),
    filled: z.boolean()
  }),
  objectBaseSchema.extend({
    type: z.literal('icon'),
    iconId: z.string().min(1).max(128),
    x: z.number().int(),
    y: z.number().int(),
    width: z.number().int().min(1).max(512),
    height: z.number().int().min(1).max(512)
  }),
  objectBaseSchema.extend({
    type: z.literal('bitmap'),
    name: z.string().min(1).max(128),
    x: z.number().int(),
    y: z.number().int(),
    width: z.number().int().min(1).max(512),
    height: z.number().int().min(1).max(512),
    bytes: z.array(z.number().int().min(0).max(255)).max(65536)
  }),
  objectBaseSchema.extend({
    type: z.literal('special'),
    kind: z.enum(['checkbox', 'radio', 'progress', 'battery', 'signal', 'scrollbar']),
    x: z.number().int(),
    y: z.number().int(),
    width: z.number().int().min(1).max(512),
    height: z.number().int().min(1).max(512),
    checked: z.boolean(),
    value: z.number().int().min(0).max(100)
  }),
  objectBaseSchema.extend({
    type: z.literal('invert'),
    x: z.number().int(),
    y: z.number().int(),
    width: z.number().int().min(1).max(512),
    height: z.number().int().min(1).max(512)
  })
]);

export const canvasDataSchema = z.object({
  stateId: z.string().min(1).max(128),
  width: z.number().int().min(16).max(512).default(SCREEN_W),
  height: z.number().int().min(16).max(512).default(SCREEN_H),
  objects: z.array(displayObjectSchema).max(2000),
  selectedObjectIds: z.array(z.string()).default([]),
  updatedAt: z.string().datetime()
});

export const portableScreenSchema = z.object({
  id: z.string().min(1).max(128),
  name: z.string().min(1).max(160),
  description: z.string().max(2048).default(''),
  tags: z.array(z.string().min(1).max(48)).max(32).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  author: z.string().max(160).default(''),
  objects: z.array(displayObjectSchema).max(2000),
  invertedRow: z.object({
    enabled: z.boolean(),
    y: z.number().int().min(0).max(511),
    h: z.number().int().min(1).max(512)
  }).default({ enabled: false, y: 0, h: 8 }),
  transitions: z.array(z.object({
    transitionId: z.string().min(1).max(128),
    targetScreenId: z.string().min(1).max(128)
  })).default([])
});

export type PortableScreen = z.infer<typeof portableScreenSchema>;
