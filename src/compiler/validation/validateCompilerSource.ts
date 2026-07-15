import type { CompilerSourceSnapshot } from '../source/compilerSource';
import { compilerDiagnostic, type CompilerDiagnostic } from './compilerDiagnostics';

const MAX_RESOURCE_BYTES = 1024 * 1024;

export function validateCompilerSource(source: CompilerSourceSnapshot): readonly CompilerDiagnostic[] {
  const diagnostics: CompilerDiagnostic[] = [];
  const { project } = source;

  if (project.display.colorMode !== 'monochrome' || project.display.packing !== 'vertical-lsb') {
    diagnostics.push(compilerDiagnostic(
      'compiler.source.display-unsupported',
      'error',
      'Only monochrome vertical-LSB displays are supported by compiler IR v1.',
      { entityType: 'display', entityId: project.meta.id, path: '/display' }
    ));
  }

  project.fsm.stateOrder.forEach((stateId) => {
    const state = project.fsm.states[stateId];
    if (!state) {
      diagnostics.push(compilerDiagnostic(
        'compiler.source.state-missing',
        'error',
        `State order references missing state "${stateId}".`,
        { entityType: 'fsm-state', entityId: stateId, path: `/fsm/stateOrder/${stateId}` }
      ));
      return;
    }
    if (state.screenId && !project.screens[state.screenId]) {
      diagnostics.push(compilerDiagnostic(
        'compiler.source.screen-missing',
        'error',
        `State "${stateId}" references missing screen "${state.screenId}".`,
        { entityType: 'screen', entityId: state.screenId, path: `/fsm/states/${stateId}/screenId` }
      ));
    }
  });

  project.fsm.transitionOrder.forEach((transitionId) => {
    const transition = project.fsm.transitions[transitionId];
    if (!transition) {
      return;
    }
    if (!project.fsm.states[transition.from] || !project.fsm.states[transition.to]) {
      diagnostics.push(compilerDiagnostic(
        'compiler.source.transition-endpoint-missing',
        'error',
        `Transition "${transitionId}" has a missing endpoint.`,
        { entityType: 'fsm-transition', entityId: transitionId, path: `/fsm/transitions/${transitionId}` }
      ));
    }
    if (!project.fsm.events[transition.trigger.eventId]) {
      diagnostics.push(compilerDiagnostic(
        'compiler.source.event-missing',
        'warning',
        `Transition "${transitionId}" references missing event "${transition.trigger.eventId}".`,
        { entityType: 'fsm-event', entityId: transition.trigger.eventId, path: `/fsm/transitions/${transitionId}/trigger/eventId` }
      ));
    }
  });

  project.screenOrder.forEach((screenId) => {
    const screen = project.screens[screenId];
    if (!screen) {
      diagnostics.push(compilerDiagnostic(
        'compiler.source.screen-missing',
        'error',
        `Screen order references missing screen "${screenId}".`,
        { entityType: 'screen', entityId: screenId, path: `/screenOrder/${screenId}` }
      ));
      return;
    }
    screen.objects.forEach((object) => {
      if (object.type === 'bitmap' && object.bytes.length > MAX_RESOURCE_BYTES) {
        diagnostics.push(compilerDiagnostic(
          'compiler.source.resource-too-large',
          'warning',
          `Bitmap object "${object.id}" contains ${object.bytes.length} bytes.`,
          { entityType: 'canvas-object', entityId: object.id, path: `/screens/${screenId}/objects/${object.id}/bytes` }
        ));
      }
    });
  });

  return diagnostics;
}
