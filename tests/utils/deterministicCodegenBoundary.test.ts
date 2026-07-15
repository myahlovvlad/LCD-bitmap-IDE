import { describe, expect, it } from 'vitest';
import { createDemoProject } from '../../src/entities/project/demo';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import {
  compileLegacyCodegen,
  compareArtifactSets,
  createCodegenArtifact,
  createCodegenArtifactSet,
  sha256Hex
} from '../../src/compiler';
import { FontRenderer, type CanvasData, type FontGlyphs, type LcdBitmapProject } from '../../src/domain';
import {
  generateAllScreensBinary as generateLegacyAllScreensBinary,
  generateAllScreensCHeader as generateLegacyAllScreensCHeader,
  generateScreenBinary as generateLegacyScreenBinary,
  generateScreenCArray as generateLegacyScreenCArray
} from '../../src/renderer/utils/codegen';

describe('deterministic codegen boundary', () => {
  it('uses a browser-safe SHA-256 digest compatible with the legacy characterization hashes', () => {
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex(Uint8Array.from([0, 1, 2, 255])))
      .toBe('3d1f57c984978ef98a18378c8166c1cb8ede02c03eeb6aee7e2f121dfeee3e56');
  });

  it('generates selected-screen C and binary artifacts byte-for-byte equal to the legacy renderer generator', () => {
    const project = demoProject();
    const screen = canvasFor(project, 'main-menu');
    const actual = compileLegacyCodegen({
      project,
      language: 'en',
      request: {
        scope: 'selected-screen',
        selectedScreenId: screen.stateId,
        selectedSymbolName: `${screen.stateId}_screen`
      }
    }).artifacts;
    const expected = createCodegenArtifactSet('legacy-renderer-oracle', 'legacy-lcd-vertical-lsb', undefined, [
      createCodegenArtifact(
        'c-header',
        `${screen.stateId}_screen.h`,
        'text/x-c',
        generateLegacyScreenCArray(screen.objects, {
          symbolName: `${screen.stateId}_screen`,
          language: 'en',
          width: screen.width,
          height: screen.height
        })
      ),
      createCodegenArtifact(
        'binary',
        `${screen.stateId}_screen.bin`,
        'application/octet-stream',
        generateLegacyScreenBinary(screen.objects, 'en', undefined, screen.width, screen.height)
      )
    ]);

    const equivalence = compareArtifactSets(expected, actual);
    expect(equivalence).toEqual({ pass: true, mismatches: [] });
    expect(actual.manifest.artifacts.map((artifact) => artifact.kind)).toEqual(['c-header', 'binary']);
  });

  it('generates all-screen C and binary artifacts byte-for-byte equal to the legacy renderer generator', () => {
    const project = demoProject();
    const canvases = canvasesFor(project);
    const actual = compileLegacyCodegen({
      project,
      language: 'en',
      request: {
        scope: 'all-screens',
        projectSymbolName: project.meta.name
      }
    }).artifacts;
    const expected = createCodegenArtifactSet('legacy-renderer-oracle', 'legacy-lcd-vertical-lsb', undefined, [
      createCodegenArtifact(
        'c-header',
        `${project.meta.id}_lcd_screens.h`,
        'text/x-c',
        generateLegacyAllScreensCHeader(canvases, { projectSymbolName: project.meta.name, language: 'en' })
      ),
      createCodegenArtifact(
        'binary',
        `${project.meta.id}_lcd_screens.bin`,
        'application/octet-stream',
        generateLegacyAllScreensBinary(canvases, 'en')
      )
    ]);

    expect(compareArtifactSets(expected, actual)).toEqual({ pass: true, mismatches: [] });
  });

  it('keeps custom font glyphs inside the deterministic compiler source boundary', () => {
    const project = demoProject();
    const firstScreenId = project.screenOrder[0];
    const firstScreen = project.screens[firstScreenId];
    const customProject: LcdBitmapProject = {
      ...project,
      screens: {
        ...project.screens,
        [firstScreenId]: {
          ...firstScreen,
          objects: [{
            id: 'text-hi',
            type: 'text',
            text: { en: 'Hi', ru: 'Hi', zh: 'Hi' },
            x: 0,
            y: 0,
            fontVariant: '1',
            pendingTranslation: false,
            zIndex: 0,
            visible: true,
            locked: false,
            source: 'user'
          }]
        }
      }
    };
    const fontGlyphs: FontGlyphs = {
      '1': {
        H: { width: 1, data: ['#'] },
        i: { width: 1, data: ['#'] },
        ' ': { width: 1, data: ['.'] }
      },
      '2': {
        ' ': { width: 1, data: ['.'] }
      }
    };
    const actualBinary = artifactContent<Uint8Array>(compileLegacyCodegen({
      project: customProject,
      fontGlyphs,
      language: 'en',
      request: {
        scope: 'selected-screen',
        selectedScreenId: firstScreenId,
        selectedSymbolName: `${firstScreenId}_screen`
      }
    }).artifacts.artifacts, 'binary');

    expect(sha256Hex(actualBinary))
      .toBe(sha256Hex(generateLegacyScreenBinary(customProject.screens[firstScreenId].objects, 'en', new FontRenderer(fontGlyphs))));
  });
});

function demoProject(): LcdBitmapProject {
  return migrateLegacySnapshot(createDemoProject()).project;
}

function canvasesFor(project: LcdBitmapProject): CanvasData[] {
  return project.screenOrder.map((screenId) => canvasFor(project, screenId));
}

function canvasFor(project: LcdBitmapProject, screenId: string): CanvasData {
  const screen = project.screens[screenId];
  return {
    stateId: screen.id,
    width: screen.width,
    height: screen.height,
    objects: screen.objects,
    selectedObjectIds: screen.selectedObjectIds,
    updatedAt: screen.updatedAt
  };
}

function artifactContent<T extends string | Uint8Array>(
  artifacts: readonly { kind: string; content: string | Uint8Array }[],
  kind: string
): T {
  const artifact = artifacts.find((item) => item.kind === kind);
  if (!artifact) {
    throw new Error(`Missing artifact: ${kind}`);
  }
  return artifact.content as T;
}
