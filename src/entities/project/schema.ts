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

export const displayProfileSchema = z.object({
  id: z.string().min(1).max(256),
  schemaVersion: z.literal(1),
  name: z.string().min(1).max(256),
  controller: z.string().min(1).max(256).optional(),
  width: z.number().int().min(16).max(4096),
  height: z.number().int().min(16).max(4096),
  pixelFormat: z.enum(['mono1', 'gray2', 'gray4', 'indexed8', 'rgb332', 'rgb565', 'rgb888', 'argb8888']),
  bitsPerPixel: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(8), z.literal(16), z.literal(24), z.literal(32)]),
  packing: z.enum(['vertical-pages', 'horizontal-row-major', 'planar', 'interleaved']),
  bitOrder: z.enum(['lsb-first', 'msb-first']),
  byteOrder: z.enum(['little-endian', 'big-endian']),
  rowStride: z.number().int().positive().optional(),
  pageHeight: z.number().int().positive().optional(),
  alignment: z.number().int().positive().max(4096).optional(),
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  mirrorX: z.boolean(),
  mirrorY: z.boolean(),
  inverted: z.boolean(),
  palette: z.array(z.string()).max(256).optional(),
  fingerprint: z.string().regex(/^fnv1a64:[0-9a-f]{16}$/)
});

export const projectSchema = z.object({
  id: z.string().min(1).max(128),
  name: z.string().min(1).max(160),
  version: z.string().min(1).max(32),
  modelId: z.enum(['Universal-LCD-128x64']),
  firmwareVersion: z.string().max(80).nullable(),
  author: z.string().max(160).nullable(),
  lastModified: z.string().datetime(),
  display: z.union([displayConfigSchema, displayProfileSchema]),
  states: z.record(z.string(), fsmStateSchema),
  transitions: z.record(z.string(), fsmTransitionSchema),
  canvasByStateId: z.record(z.string(), canvasDataSchema),
  graphLayout: z.record(z.string(), z.object({ x: z.number(), y: z.number(), z: z.number().optional() })),
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
