import { describe, expect, it } from 'vitest';
import { createBlankProject } from '../../src/entities/project/factory';
import { migrateLegacySnapshot } from '../../src/services/projectMigrationService';
import { compileLegacyCodegen, generateAnimationCHeader } from '../../src/compiler';

describe('animation C code generation', () => {
  it('exports ordered frame arrays, duration metadata, resources and persisted bindings', () => {
    const header = headerFor(animationProject());

    expect(header).toContain('typedef struct { const uint8_t *bytes; uint32_t byte_count; uint32_t duration_ms; } lcd_animation_frame_t;');
    expect(header).toContain('typedef struct { const lcd_animation_frame_t *frames; uint16_t frame_count; bool loop; } lcd_animation_t;');
    expect(header).toContain('static const uint8_t project_spinner_frame_0[16]');
    expect(header).toContain('static const uint8_t project_spinner_frame_1[16]');
    expect(header).toContain('{ project_spinner_frame_0, 16, 120 }');
    expect(header).toContain('{ project_spinner_frame_1, 16, 80 }');
    expect(header).toContain('{ "spinner", &project_spinner }');
    expect(header).toMatch(/\{ "screen-[^"]+", NULL, "spinner", &project_spinner \}/);
    expect(header).toMatch(/\{ "screen-[^"]+", "animated-bitmap", "spinner", &project_spinner \}/);
    expect(header.indexOf('project_spinner_frame_0')).toBeLessThan(header.indexOf('project_spinner_frame_1'));
  });

  it('keeps static-project legacy C output free of animation declarations', () => {
    const project = staticProject();
    const legacyProject = { ...project } as Partial<typeof project>;
    delete legacyProject.animations;
    const header = headerFor(project);

    expect(header).not.toContain('lcd_animation_');
    expect(header).not.toContain('#include <stdbool.h>');
    expect(headerFor(legacyProject as typeof project)).toBe(header);
  });

  it('does not emit a zero-length binding array when resources are unbound', () => {
    const header = generateAnimationCHeader([{
      id: 'idle', symbol: 'idle', loop: false,
      frames: [{ id: 'frame', bytes: [0], durationMs: 1 }]
    }], 'project', 16);

    expect(header).not.toContain('project_animation_bindings[0]');
    expect(header).toContain('#define PROJECT_ANIMATION_BINDING_COUNT 0');
  });
});

function headerFor(project: ReturnType<typeof staticProject>): string {
  const artifact = compileLegacyCodegen({
    project,
    language: 'en',
    request: { scope: 'all-screens', projectSymbolName: 'project' }
  }).artifacts.artifacts[0];
  return artifact.content as string;
}

function staticProject() {
  return migrateLegacySnapshot(createBlankProject({ name: 'Animation codegen' })).project;
}

function animationProject() {
  const project = staticProject();
  const screen = project.screens[project.screenOrder[0]];
  return {
    ...project,
    animations: {
      order: ['spinner'],
      resources: {
        spinner: {
          id: 'spinner', name: 'Spinner', width: 8, height: 16, loop: true,
          frames: [
            { id: 'slow', bytes: Array.from({ length: 16 }, () => 0x01), durationMs: 120 },
            { id: 'fast', bytes: Array.from({ length: 16 }, () => 0x80), durationMs: 80 }
          ]
        }
      }
    },
    screens: {
      ...project.screens,
      [screen.id]: {
        ...screen,
        animationId: 'spinner',
        objects: [{
          id: 'animated-bitmap', type: 'bitmap' as const, name: 'Animated', x: 0, y: 0,
          width: 8, height: 16, bytes: Array.from({ length: 16 }, () => 0), animationId: 'spinner',
          zIndex: 0, visible: true, locked: false, source: 'user' as const
        }]
      }
    }
  };
}
