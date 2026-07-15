/**
 * @module entities/project/schema
 * @description Zod schema for the portable `.lcdproj` format. This is the
 * compatibility contract for exchanging projects with similar professional LCD
 * tools while preserving SpectroDesigner-specific data in a typed envelope.
 */

import { z } from 'zod';
import { canvasDataSchema, portableScreenSchema } from '../screen/schema';

export const fsmStateSchema = z.object({
  id: z.string().min(1).max(128),
  runtimeId: z.string().nullable(),
  legacyIds: z.array(z.string()).default([]),
  title: z.string().min(1).max(160),
  subsystem: z.string().min(1).max(96),
  stateType: z.string().min(1).max(64),
  origin: z.string().min(1).max(96),
  sourceLcd: z.array(z.string()).default([]),
  initial: z.boolean(),
  final: z.boolean()
});

export const fsmTransitionSchema = z.object({
  id: z.string().min(1).max(128),
  from: z.string().min(1).max(128),
  to: z.string().min(1).max(128),
  trigger: z.string().min(1).max(160),
  kind: z.string().min(1).max(96),
  condition: z.string().max(512).nullable(),
  source: z.string().max(256).nullable(),
  cliCommands: z.array(z.string().max(512)).max(64)
});

export const displayConfigSchema = z.object({
  width: z.number().int().min(16).max(512),
  height: z.number().int().min(16).max(512),
  colorMode: z.literal('monochrome'),
  packing: z.literal('vertical-lsb')
});

export const projectSchema = z.object({
  id: z.string().min(1).max(128),
  name: z.string().min(1).max(160),
  version: z.string().min(1).max(32),
  modelId: z.enum(['Universal-LCD-128x64']),
  firmwareVersion: z.string().max(80).nullable(),
  author: z.string().max(160).nullable(),
  lastModified: z.string().datetime(),
  display: displayConfigSchema,
  states: z.record(z.string(), fsmStateSchema),
  transitions: z.record(z.string(), fsmTransitionSchema),
  canvasByStateId: z.record(z.string(), canvasDataSchema),
  graphLayout: z.record(z.string(), z.object({ x: z.number(), y: z.number() })),
  auditTrail: z.array(z.unknown()).max(10000)
});

export const projectFilePayloadSchema = z.object({
  kind: z.literal('spectrodesigner-project'),
  version: z.union([z.literal(1), z.literal(2), z.literal(4)]),
  savedAt: z.string().datetime(),
  language: z.enum(['en', 'ru', 'zh']),
  project: projectSchema,
  stateOrder: z.array(z.string()),
  transitionOrder: z.array(z.string()),
  fontGlyphs: z.unknown().optional(),
  loadedFonts: z.array(z.unknown()).optional(),
  savedMeasurements: z.array(z.unknown()).optional()
});

export const lcdProjectSchema = z.object({
  projectId: z.string().min(1).max(128),
  formatVersion: z.literal('1.0'),
  name: z.string().min(1).max(160),
  deviceModel: z.string().min(1).max(160),
  firmwareVersion: z.string().max(80),
  author: z.string().max(160),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  screens: z.array(portableScreenSchema).min(1).max(512),
  stateMachine: z.object({
    states: z.array(fsmStateSchema).max(512),
    transitions: z.array(fsmTransitionSchema).max(2048)
  }),
  fontData: z.unknown()
});

export type LcdProject = z.infer<typeof lcdProjectSchema>;
