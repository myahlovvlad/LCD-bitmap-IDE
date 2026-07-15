import type {
  CanvasObject,
  DisplayConfig,
  FontGlyphs,
  GraphPosition
} from '../domain';
import type {
  ControlPanelElement,
  FsmEvent,
  FsmState,
  FsmTransition,
  LcdBitmapProject,
  LcdScreen
} from '../domain/project';
import { applyFsmInterchangeToProject } from '../fsm-interchange';
import { screenInterchangeToLcdScreens } from '../screen-interchange';
import type { ApplicationCommandContext } from './commandContext';
import type { ProjectCommand } from './commandTypes';
import type { SemanticChange } from './semanticChange';
import type { ApplicationWorkspace } from './workspace';

export interface ProjectMutationResult {
  workspace: ApplicationWorkspace;
  changes: SemanticChange[];
}

export function applyProjectCommandMutation(
  workspace: ApplicationWorkspace,
  command: ProjectCommand,
  context: ApplicationCommandContext
): ProjectMutationResult {
  switch (command.type) {
    case 'project.updateMetadata':
      return updateProjectMetadata(workspace, command.payload, context);
    case 'project.updateDisplayConfig':
      return updateDisplayConfig(workspace, command.payload.display, context);
    case 'fsm.state.add':
      return addFsmState(workspace, context);
    case 'fsm.state.update':
      return updateFsmState(workspace, command.payload.stateId, command.payload.updates, context);
    case 'fsm.state.delete':
      return deleteFsmState(workspace, command.payload.stateId, context);
    case 'fsm.state.ensureScreen':
      return ensureStateScreen(workspace, command.payload.stateId, context);
    case 'fsm.transition.add':
      return addFsmTransition(workspace, command.payload, context);
    case 'fsm.transition.update':
      return updateFsmTransition(workspace, command.payload.transitionId, command.payload.updates, context);
    case 'fsm.transition.delete':
      return deleteFsmTransition(workspace, command.payload.transitionId, context);
    case 'fsm.event.add':
      return addFsmEvent(workspace, command.payload.name, context);
    case 'fsm.event.update':
      return updateFsmEvent(workspace, command.payload.eventId, command.payload.updates, context);
    case 'fsm.event.delete':
      return deleteFsmEvent(workspace, command.payload.eventId, context);
    case 'fsm.graphPosition.update':
      return updateGraphPosition(workspace, command.payload.stateId, command.payload.position, context);
    case 'fsm.graphPositions.update':
      return updateGraphPositions(workspace, command.payload.positions, context);
    case 'fsm.semanticRoundTrip.apply':
      return applyFsmSemanticRoundTrip(workspace, command.payload.model, context);
    case 'screen.create':
      return createScreenWithState(workspace, command.payload.name, context);
    case 'screen.duplicate':
      return duplicateScreen(workspace, command.payload.screenId, context);
    case 'screen.rename':
      return renameScreen(workspace, command.payload.screenId, command.payload.name, context);
    case 'screen.resize':
      return resizeScreen(workspace, command.payload.screenId, command.payload.width, command.payload.height, context);
    case 'screen.delete':
      return deleteScreen(workspace, command.payload.screenId, context);
    case 'screen.reorder':
      return reorderScreens(workspace, command.payload.screenIds);
    case 'screen.createFromTemplate':
      return createScreenFromTemplate(workspace, command.payload.template, context);
    case 'screen.dsl.apply':
      return applyScreenDslPackage(workspace, command.payload.package, command.payload.mode, context);
    case 'controlPanel.element.add':
      return addControlElement(workspace, command.payload.elementType, context);
    case 'controlPanel.element.update':
      return updateControlElement(workspace, command.payload.elementId, command.payload.updates, context);
    case 'controlPanel.elements.delete':
      return deleteControlElements(workspace, command.payload.elementIds, context);
    case 'controlPanel.elements.group':
      return groupControlElements(workspace, command.payload.elementIds, context);
    case 'controlPanel.elements.ungroup':
      return ungroupControlElements(workspace, command.payload.elementIds, context);
    case 'controlPanel.elements.align':
      return alignControlElements(workspace, command.payload.elementIds, command.payload.axis, context);
    case 'controlPanel.settings.update':
      return updateControlPanelSettings(workspace, command.payload.updates, context);
    case 'canvas.object.update':
      return updateCanvasObject(workspace, command.payload.screenId, command.payload.object, context);
    case 'canvas.selection.set':
      return setCanvasSelection(workspace, command.payload.screenId, command.payload.objectIds);
    case 'canvas.object.add':
      return addCanvasObject(workspace, command.payload.screenId, command.payload.object, context);
    case 'canvas.bitmapLayer.add':
      return addBitmapLayer(workspace, command.payload.screenId, command.payload.name, command.payload.bytes, context);
    case 'canvas.objects.update':
      return updateCanvasObjects(workspace, command.payload.screenId, command.payload.objects, context);
    case 'canvas.objects.delete':
      return deleteCanvasObjects(workspace, command.payload.screenId, command.payload.objectIds, context);
    case 'font.glyph.update':
      return updateGlyph(workspace, command.payload.variant, command.payload.char, command.payload.glyph);
    case 'font.glyphs.import':
      return importFontGlyphs(workspace, command.payload.variant, command.payload.glyphs, command.payload.metadata, command.payload.mode);
    case 'measurement.add':
      return addSavedMeasurement(workspace, command.payload.stateId, command.payload.label, command.payload.value, context);
    case 'measurement.update':
      return updateSavedMeasurement(workspace, command.payload.measurement, context);
    case 'measurement.delete':
      return deleteSavedMeasurement(workspace, command.payload.measurementId);
  }
}

function applyFsmSemanticRoundTrip(
  workspace: ApplicationWorkspace,
  model: Extract<ProjectCommand, { type: 'fsm.semanticRoundTrip.apply' }>['payload']['model'],
  context: ApplicationCommandContext
): ProjectMutationResult {
  const result = applyFsmInterchangeToProject(workspace.project, model, context.now());
  if (result.changes.length === 0) {
    return noChange(workspace);
  }
  return changedProject(workspace, result.project, [...result.changes]);
}

const METADATA_TRACKED_FIELDS = ['name', 'version', 'author', 'firmwareVersion', 'modelId'] as const;

function updateProjectMetadata(
  workspace: ApplicationWorkspace,
  updates: Partial<Pick<LcdBitmapProject['meta'], 'name' | 'version' | 'author' | 'firmwareVersion' | 'modelId'>>,
  context: ApplicationCommandContext
): ProjectMutationResult {
  const project = workspace.project;
  const nextMeta = { ...project.meta, ...updates, updatedAt: context.now() };
  const unchanged = METADATA_TRACKED_FIELDS.every((field) => project.meta[field] === nextMeta[field]);
  if (unchanged) {
    return noChange(workspace);
  }
  return changedProject(workspace, { ...project, meta: nextMeta }, [{
    kind: 'updated',
    entityType: 'project',
    entityId: project.meta.id,
    path: '/meta',
    before: pick(project.meta, [...METADATA_TRACKED_FIELDS]),
    after: pick(nextMeta, [...METADATA_TRACKED_FIELDS])
  }]);
}

function updateDisplayConfig(
  workspace: ApplicationWorkspace,
  display: DisplayConfig,
  context: ApplicationCommandContext
): ProjectMutationResult {
  const project = workspace.project;
  const nextDisplay: DisplayConfig = {
    width: clamp(display.width, 16, 512),
    height: clamp(display.height, 16, 512),
    colorMode: 'monochrome',
    packing: 'vertical-lsb'
  };
  const screens = Object.fromEntries(Object.entries(project.screens).map(([id, screen]) => [
    id,
    { ...screen, width: nextDisplay.width, height: nextDisplay.height, updatedAt: context.now() }
  ]));
  return changedProject(workspace, {
    ...project,
    display: nextDisplay,
    screens,
    meta: { ...project.meta, updatedAt: context.now() }
  }, [{
    kind: 'updated',
    entityType: 'display',
    entityId: project.meta.id,
    path: '/display',
    before: project.display,
    after: nextDisplay
  }]);
}

function addFsmState(workspace: ApplicationWorkspace, context: ApplicationCommandContext): ProjectMutationResult {
  const project = workspace.project;
  const id = context.createId(project.fsm.states, 'state');
  const title = `State ${project.fsm.stateOrder.length + 1}`;
  const screenId = createScreenId(project, title);
  const state = createState(project, id, title, screenId);
  const screen = createLcdScreen(project, screenId, title, context.now());
  return changedProject(workspace, {
    ...project,
    meta: { ...project.meta, updatedAt: context.now() },
    screens: { ...project.screens, [screenId]: screen },
    screenOrder: [...project.screenOrder, screenId],
    fsm: {
      ...project.fsm,
      states: { ...project.fsm.states, [id]: state },
      stateOrder: [...project.fsm.stateOrder, id],
      graphLayout: { ...project.fsm.graphLayout, [id]: createGraphPosition(project.fsm.stateOrder.length) }
    }
  }, [
    created('fsm-state', id, `/fsm/states/${id}`, state),
    created('screen', screenId, `/screens/${screenId}`, screen)
  ]);
}

function updateFsmState(
  workspace: ApplicationWorkspace,
  stateId: string,
  updates: Partial<FsmState>,
  context: ApplicationCommandContext
): ProjectMutationResult {
  const project = workspace.project;
  const state = project.fsm.states[stateId];
  if (!state) {
    return noChange(workspace);
  }
  const stateType = updates.stateType ?? state.stateType;
  const nextState: FsmState = {
    ...state,
    ...updates,
    id: stateId,
    initial: stateType === 'initial' ? true : updates.initial ?? state.initial,
    terminal: stateType === 'success' || stateType === 'failure' ? true : updates.terminal ?? state.terminal
  };
  const nextScreens = state.screenId && project.screens[state.screenId] && typeof updates.title === 'string'
    ? { ...project.screens, [state.screenId]: { ...project.screens[state.screenId], name: updates.title, updatedAt: context.now() } }
    : project.screens;
  if (sameJson(state, nextState) && nextScreens === project.screens) {
    return noChange(workspace);
  }
  return changedProject(workspace, {
    ...project,
    meta: { ...project.meta, updatedAt: context.now() },
    screens: nextScreens,
    fsm: { ...project.fsm, states: { ...project.fsm.states, [stateId]: nextState } }
  }, [{ kind: 'updated', entityType: 'fsm-state', entityId: stateId, path: `/fsm/states/${stateId}`, before: state, after: nextState }]);
}

function deleteFsmState(workspace: ApplicationWorkspace, stateId: string, context: ApplicationCommandContext): ProjectMutationResult {
  const project = workspace.project;
  const state = project.fsm.states[stateId];
  if (!state) {
    return noChange(workspace);
  }
  const transitionOrder = project.fsm.transitionOrder.filter((id) => {
    const transition = project.fsm.transitions[id];
    return transition && transition.from !== stateId && transition.to !== stateId;
  });
  const removedTransitionIds = project.fsm.transitionOrder.filter((id) => !transitionOrder.includes(id));
  return changedProject(workspace, {
    ...project,
    meta: { ...project.meta, updatedAt: context.now() },
    screens: state.screenId ? omit(project.screens, state.screenId) : project.screens,
    screenOrder: state.screenId ? project.screenOrder.filter((id) => id !== state.screenId) : project.screenOrder,
    fsm: {
      ...project.fsm,
      states: omit(project.fsm.states, stateId),
      stateOrder: project.fsm.stateOrder.filter((id) => id !== stateId),
      transitions: Object.fromEntries(transitionOrder.map((id) => [id, project.fsm.transitions[id]])),
      transitionOrder,
      graphLayout: omit(project.fsm.graphLayout, stateId)
    }
  }, [
    deleted('fsm-state', stateId, `/fsm/states/${stateId}`, state),
    ...(state.screenId && project.screens[state.screenId] ? [deleted('screen', state.screenId, `/screens/${state.screenId}`, project.screens[state.screenId])] : []),
    ...removedTransitionIds.map((id) => deleted('fsm-transition', id, `/fsm/transitions/${id}`, project.fsm.transitions[id]))
  ]);
}

function ensureStateScreen(workspace: ApplicationWorkspace, stateId: string, context: ApplicationCommandContext): ProjectMutationResult {
  const project = workspace.project;
  const state = project.fsm.states[stateId];
  if (!state || (state.screenId && project.screens[state.screenId])) {
    return noChange(workspace);
  }
  const screenId = createScreenId(project, state.title);
  const screen = createLcdScreen(project, screenId, state.title, context.now());
  const nextState = { ...state, screenId };
  return changedProject(workspace, {
    ...project,
    meta: { ...project.meta, updatedAt: context.now() },
    screens: { ...project.screens, [screenId]: screen },
    screenOrder: [...project.screenOrder, screenId],
    fsm: { ...project.fsm, states: { ...project.fsm.states, [stateId]: nextState } }
  }, [
    created('screen', screenId, `/screens/${screenId}`, screen),
    { kind: 'updated', entityType: 'fsm-state', entityId: stateId, path: `/fsm/states/${stateId}`, before: state, after: nextState }
  ]);
}

function addFsmTransition(
  workspace: ApplicationWorkspace,
  payload: Extract<ProjectCommand, { type: 'fsm.transition.add' }>['payload'],
  context: ApplicationCommandContext
): ProjectMutationResult {
  const project = workspace.project;
  if (!project.fsm.states[payload.from] || !project.fsm.states[payload.to]) {
    return noChange(workspace);
  }
  let nextEventId = payload.eventId;
  let events = project.fsm.events;
  let eventOrder = project.fsm.eventOrder;
  const changes: SemanticChange[] = [];
  if (!nextEventId || !events[nextEventId]) {
    nextEventId = context.createId(events, 'EVENT').toUpperCase();
    const event = { id: nextEventId, name: nextEventId };
    events = { ...events, [nextEventId]: event };
    eventOrder = [...eventOrder, nextEventId];
    changes.push(created('fsm-event', nextEventId, `/fsm/events/${nextEventId}`, event));
  }
  const id = context.createId(project.fsm.transitions, `transition-${payload.from}-${payload.to}`);
  const transition: FsmTransition = {
    id,
    from: payload.from,
    to: payload.to,
    sourceHandle: payload.handles?.sourceHandle ?? (payload.from === payload.to ? 's-right' : 's-right'),
    targetHandle: payload.handles?.targetHandle ?? (payload.from === payload.to ? 't-right' : 't-left'),
    trigger: { eventId: nextEventId },
    kind: 'navigation',
    condition: null,
    source: 'user',
    backendProcessId: null
  };
  return changedProject(workspace, {
    ...project,
    meta: { ...project.meta, updatedAt: context.now() },
    fsm: {
      ...project.fsm,
      events,
      eventOrder,
      transitions: { ...project.fsm.transitions, [id]: transition },
      transitionOrder: [...project.fsm.transitionOrder, id]
    }
  }, [...changes, created('fsm-transition', id, `/fsm/transitions/${id}`, transition)]);
}

function updateFsmTransition(
  workspace: ApplicationWorkspace,
  transitionId: string,
  updates: Partial<FsmTransition>,
  context: ApplicationCommandContext
): ProjectMutationResult {
  const project = workspace.project;
  const transition = project.fsm.transitions[transitionId];
  if (!transition) {
    return noChange(workspace);
  }
  const nextTransition = { ...transition, ...updates, id: transitionId };
  if (sameJson(transition, nextTransition)) {
    return noChange(workspace);
  }
  return changedProject(workspace, {
    ...project,
    meta: { ...project.meta, updatedAt: context.now() },
    fsm: { ...project.fsm, transitions: { ...project.fsm.transitions, [transitionId]: nextTransition } }
  }, [{ kind: 'updated', entityType: 'fsm-transition', entityId: transitionId, path: `/fsm/transitions/${transitionId}`, before: transition, after: nextTransition }]);
}

function deleteFsmTransition(workspace: ApplicationWorkspace, transitionId: string, context: ApplicationCommandContext): ProjectMutationResult {
  const project = workspace.project;
  const transition = project.fsm.transitions[transitionId];
  if (!transition) {
    return noChange(workspace);
  }
  return changedProject(workspace, {
    ...project,
    meta: { ...project.meta, updatedAt: context.now() },
    fsm: {
      ...project.fsm,
      transitions: omit(project.fsm.transitions, transitionId),
      transitionOrder: project.fsm.transitionOrder.filter((id) => id !== transitionId)
    }
  }, [deleted('fsm-transition', transitionId, `/fsm/transitions/${transitionId}`, transition)]);
}

function addFsmEvent(
  workspace: ApplicationWorkspace,
  name: string | undefined,
  context: ApplicationCommandContext
): ProjectMutationResult {
  const project = workspace.project;
  const id = context.createId(project.fsm.events, 'EVENT').toUpperCase();
  const event: FsmEvent = { id, name: name?.trim() || id };
  return changedProject(workspace, {
    ...project,
    meta: { ...project.meta, updatedAt: context.now() },
    fsm: {
      ...project.fsm,
      events: { ...project.fsm.events, [id]: event },
      eventOrder: [...project.fsm.eventOrder, id]
    }
  }, [created('fsm-event', id, `/fsm/events/${id}`, event)]);
}

function updateFsmEvent(
  workspace: ApplicationWorkspace,
  eventId: string,
  updates: Partial<Pick<FsmEvent, 'name' | 'description'>>,
  context: ApplicationCommandContext
): ProjectMutationResult {
  const project = workspace.project;
  const event = project.fsm.events[eventId];
  if (!event) {
    return noChange(workspace);
  }
  const nextEvent = { ...event, ...updates };
  if (sameJson(event, nextEvent)) {
    return noChange(workspace);
  }
  return changedProject(workspace, {
    ...project,
    meta: { ...project.meta, updatedAt: context.now() },
    fsm: { ...project.fsm, events: { ...project.fsm.events, [eventId]: nextEvent } }
  }, [{ kind: 'updated', entityType: 'fsm-event', entityId: eventId, path: `/fsm/events/${eventId}`, before: event, after: nextEvent }]);
}

function deleteFsmEvent(workspace: ApplicationWorkspace, eventId: string, context: ApplicationCommandContext): ProjectMutationResult {
  const project = workspace.project;
  const event = project.fsm.events[eventId];
  if (!event) {
    return noChange(workspace);
  }
  return changedProject(workspace, {
    ...project,
    meta: { ...project.meta, updatedAt: context.now() },
    fsm: {
      ...project.fsm,
      events: omit(project.fsm.events, eventId),
      eventOrder: project.fsm.eventOrder.filter((id) => id !== eventId)
    }
  }, [deleted('fsm-event', eventId, `/fsm/events/${eventId}`, event)]);
}

function updateGraphPosition(workspace: ApplicationWorkspace, stateId: string, position: GraphPosition, context: ApplicationCommandContext): ProjectMutationResult {
  const project = workspace.project;
  return changedProject(workspace, {
    ...project,
    meta: { ...project.meta, updatedAt: context.now() },
    fsm: { ...project.fsm, graphLayout: { ...project.fsm.graphLayout, [stateId]: position } }
  }, [{ kind: 'updated', entityType: 'graph-position', entityId: stateId, path: `/fsm/graphLayout/${stateId}`, before: project.fsm.graphLayout[stateId], after: position }]);
}

function updateGraphPositions(workspace: ApplicationWorkspace, positions: Record<string, GraphPosition>, context: ApplicationCommandContext): ProjectMutationResult {
  const project = workspace.project;
  return changedProject(workspace, {
    ...project,
    meta: { ...project.meta, updatedAt: context.now() },
    fsm: { ...project.fsm, graphLayout: { ...project.fsm.graphLayout, ...positions } }
  }, Object.entries(positions).map(([stateId, position]) => ({
    kind: 'updated',
    entityType: 'graph-position',
    entityId: stateId,
    path: `/fsm/graphLayout/${stateId}`,
    before: project.fsm.graphLayout[stateId],
    after: position
  })));
}

function createScreenWithState(workspace: ApplicationWorkspace, name: string | undefined, context: ApplicationCommandContext): ProjectMutationResult {
  const project = workspace.project;
  const id = createScreenId(project, name);
  const title = name ?? `Screen ${project.screenOrder.length + 1}`;
  const stateId = context.createId(project.fsm.states, title);
  const state = createState(project, stateId, title, id);
  const screen = createLcdScreen(project, id, title, context.now());
  return changedProject(workspace, {
    ...project,
    meta: { ...project.meta, updatedAt: context.now() },
    screens: { ...project.screens, [id]: screen },
    screenOrder: [...project.screenOrder, id],
    fsm: {
      ...project.fsm,
      states: { ...project.fsm.states, [stateId]: state },
      stateOrder: [...project.fsm.stateOrder, stateId],
      graphLayout: { ...project.fsm.graphLayout, [stateId]: createGraphPosition(project.fsm.stateOrder.length) }
    }
  }, [created('screen', id, `/screens/${id}`, screen), created('fsm-state', stateId, `/fsm/states/${stateId}`, state)]);
}

function duplicateScreen(workspace: ApplicationWorkspace, screenId: string, context: ApplicationCommandContext): ProjectMutationResult {
  const project = workspace.project;
  const source = project.screens[screenId];
  if (!source) {
    return noChange(workspace);
  }
  const id = createScreenId(project, `${source.name}-copy`);
  const stateId = context.createId(project.fsm.states, `${source.name}-copy`);
  const duplicated: LcdScreen = {
    ...clone(source),
    id,
    name: `${source.name} Copy`,
    objects: source.objects.map((object, index) => ({ ...clone(object), id: `canvas-${id}-${object.type}-${index + 1}`, zIndex: index })),
    selectedObjectIds: [],
    createdAt: context.now(),
    updatedAt: context.now()
  };
  const duplicatedState = createState(project, stateId, duplicated.name, id);
  duplicatedState.initial = false;
  duplicatedState.stateType = 'process';
  return changedProject(workspace, {
    ...project,
    meta: { ...project.meta, updatedAt: context.now() },
    screens: { ...project.screens, [id]: duplicated },
    screenOrder: insertAfter(project.screenOrder, screenId, id),
    fsm: {
      ...project.fsm,
      states: { ...project.fsm.states, [stateId]: duplicatedState },
      stateOrder: [...project.fsm.stateOrder, stateId],
      graphLayout: { ...project.fsm.graphLayout, [stateId]: createGraphPosition(project.fsm.stateOrder.length) }
    }
  }, [created('screen', id, `/screens/${id}`, duplicated), created('fsm-state', stateId, `/fsm/states/${stateId}`, duplicatedState)]);
}

function renameScreen(workspace: ApplicationWorkspace, screenId: string, name: string, context: ApplicationCommandContext): ProjectMutationResult {
  const project = workspace.project;
  const screen = project.screens[screenId];
  if (!screen) {
    return noChange(workspace);
  }
  const nextName = name.trim().slice(0, 160) || screen.name;
  const nextStates = Object.fromEntries(Object.entries(project.fsm.states).map(([id, state]) => [
    id,
    state.screenId === screenId ? { ...state, title: nextName } : state
  ]));
  return changedProject(workspace, {
    ...project,
    meta: { ...project.meta, updatedAt: context.now() },
    screens: { ...project.screens, [screenId]: { ...screen, name: nextName, updatedAt: context.now() } },
    fsm: { ...project.fsm, states: nextStates }
  }, [{ kind: 'updated', entityType: 'screen', entityId: screenId, path: `/screens/${screenId}`, before: { name: screen.name }, after: { name: nextName } }]);
}

function resizeScreen(workspace: ApplicationWorkspace, screenId: string, width: number, height: number, context: ApplicationCommandContext): ProjectMutationResult {
  const project = workspace.project;
  const screen = project.screens[screenId];
  if (!screen) {
    return noChange(workspace);
  }
  const nextScreen = { ...screen, width: clamp(width, 8, 1024), height: clamp(height, 8, 1024), updatedAt: context.now() };
  return changedProject(workspace, {
    ...project,
    meta: { ...project.meta, updatedAt: context.now() },
    screens: { ...project.screens, [screenId]: nextScreen }
  }, [{ kind: 'updated', entityType: 'screen', entityId: screenId, path: `/screens/${screenId}`, before: screen, after: nextScreen }]);
}

function deleteScreen(workspace: ApplicationWorkspace, screenId: string, context: ApplicationCommandContext): ProjectMutationResult {
  const project = workspace.project;
  const screen = project.screens[screenId];
  if (!screen) {
    return noChange(workspace);
  }
  const linkedStateIds = new Set(Object.values(project.fsm.states).filter((state) => state.screenId === screenId).map((state) => state.id));
  const transitionOrder = project.fsm.transitionOrder.filter((id) => {
    const transition = project.fsm.transitions[id];
    return transition && !linkedStateIds.has(transition.from) && !linkedStateIds.has(transition.to);
  });
  const removedTransitionIds = project.fsm.transitionOrder.filter((id) => !transitionOrder.includes(id));
  return changedProject(workspace, {
    ...project,
    meta: { ...project.meta, updatedAt: context.now() },
    screens: omit(project.screens, screenId),
    screenOrder: project.screenOrder.filter((id) => id !== screenId),
    fsm: {
      ...project.fsm,
      states: Object.fromEntries(Object.entries(project.fsm.states).filter(([id]) => !linkedStateIds.has(id))),
      stateOrder: project.fsm.stateOrder.filter((id) => !linkedStateIds.has(id)),
      transitions: Object.fromEntries(transitionOrder.map((id) => [id, project.fsm.transitions[id]])),
      transitionOrder,
      graphLayout: Object.fromEntries(Object.entries(project.fsm.graphLayout).filter(([id]) => !linkedStateIds.has(id)))
    }
  }, [
    deleted('screen', screenId, `/screens/${screenId}`, screen),
    ...Array.from(linkedStateIds).map((id) => deleted('fsm-state', id, `/fsm/states/${id}`, project.fsm.states[id])),
    ...removedTransitionIds.map((id) => deleted('fsm-transition', id, `/fsm/transitions/${id}`, project.fsm.transitions[id]))
  ]);
}

function reorderScreens(workspace: ApplicationWorkspace, screenIds: string[]): ProjectMutationResult {
  const project = workspace.project;
  const nextOrder = normalizeOrder(screenIds, project.screenOrder);
  return changedProject(workspace, { ...project, screenOrder: nextOrder }, [{
    kind: 'updated',
    entityType: 'screen',
    entityId: 'screenOrder',
    path: '/screenOrder',
    before: project.screenOrder,
    after: nextOrder
  }]);
}

function createScreenFromTemplate(workspace: ApplicationWorkspace, template: LcdScreen, context: ApplicationCommandContext): ProjectMutationResult {
  const project = workspace.project;
  const id = createScreenId(project, template.name);
  const stateId = context.createId(project.fsm.states, template.name);
  const screen: LcdScreen = {
    ...clone(template),
    id,
    name: `${template.name} Copy`,
    objects: template.objects.map((object, index) => ({ ...clone(object), id: `canvas-${id}-${object.type}-${index + 1}`, zIndex: index })),
    createdAt: context.now(),
    updatedAt: context.now()
  };
  const state = createState(project, stateId, screen.name, id);
  return changedProject(workspace, {
    ...project,
    meta: { ...project.meta, updatedAt: context.now() },
    screens: { ...project.screens, [id]: screen },
    screenOrder: [...project.screenOrder, id],
    fsm: {
      ...project.fsm,
      states: { ...project.fsm.states, [stateId]: state },
      stateOrder: [...project.fsm.stateOrder, stateId],
      graphLayout: { ...project.fsm.graphLayout, [stateId]: createGraphPosition(project.fsm.stateOrder.length) }
    }
  }, [created('screen', id, `/screens/${id}`, screen), created('fsm-state', stateId, `/fsm/states/${stateId}`, state)]);
}

function applyScreenDslPackage(
  workspace: ApplicationWorkspace,
  packageV1: Extract<ProjectCommand, { type: 'screen.dsl.apply' }>['payload']['package'],
  mode: 'create' | 'clone',
  context: ApplicationCommandContext
): ProjectMutationResult {
  const project = workspace.project;
  const screens = screenInterchangeToLcdScreens(packageV1);
  const createdScreens = packageV1.project.screenOrder
    .map((screenId) => screens[screenId])
    .filter((screen): screen is LcdScreen => Boolean(screen) && !project.screens[screen.id]);
  if (createdScreens.length === 0) {
    return noChange(workspace);
  }
  const nextScreens = { ...project.screens };
  createdScreens.forEach((screen) => {
    nextScreens[screen.id] = {
      ...screen,
      createdAt: screen.createdAt || context.now(),
      updatedAt: context.now()
    };
  });
  return changedProject(workspace, {
    ...project,
    meta: { ...project.meta, updatedAt: context.now() },
    screens: nextScreens,
    screenOrder: [...project.screenOrder, ...createdScreens.map((screen) => screen.id)]
  }, createdScreens.flatMap((screen) => [
    created('screen', screen.id, `/screens/${screen.id}`, screen),
    ...screen.objects.map((object) => created('canvas-object', object.id, `/screens/${screen.id}/objects/${object.id}`, object)),
    {
      kind: 'created' as const,
      entityType: 'screen',
      entityId: `${mode}:${screen.id}`,
      path: `/screenOrder/${screen.id}`,
      after: screen.id
    }
  ]));
}

function addControlElement(workspace: ApplicationWorkspace, type: ControlPanelElement['type'], context: ApplicationCommandContext): ProjectMutationResult {
  const project = workspace.project;
  const id = context.createId(project.controlPanel.elements, type);
  const element = createControlElement(project, id, type);
  return changedProject(workspace, {
    ...project,
    meta: { ...project.meta, updatedAt: context.now() },
    controlPanel: {
      ...project.controlPanel,
      elements: { ...project.controlPanel.elements, [id]: element },
      elementOrder: [...project.controlPanel.elementOrder, id]
    }
  }, [created('control-panel-element', id, `/controlPanel/elements/${id}`, element)]);
}

function updateControlElement(workspace: ApplicationWorkspace, elementId: string, updates: Partial<ControlPanelElement>, context: ApplicationCommandContext): ProjectMutationResult {
  const project = workspace.project;
  const element = project.controlPanel.elements[elementId];
  if (!element) {
    return noChange(workspace);
  }
  const nextElement = { ...element, ...updates, id: elementId, type: element.type } as ControlPanelElement;
  return changedProject(workspace, {
    ...project,
    meta: { ...project.meta, updatedAt: context.now() },
    controlPanel: { ...project.controlPanel, elements: { ...project.controlPanel.elements, [elementId]: nextElement } }
  }, [{ kind: 'updated', entityType: 'control-panel-element', entityId: elementId, path: `/controlPanel/elements/${elementId}`, before: element, after: nextElement }]);
}

function deleteControlElements(workspace: ApplicationWorkspace, elementIds: string[], context: ApplicationCommandContext): ProjectMutationResult {
  const project = workspace.project;
  const removeIds = new Set(elementIds);
  return changedProject(workspace, {
    ...project,
    meta: { ...project.meta, updatedAt: context.now() },
    controlPanel: {
      ...project.controlPanel,
      elements: Object.fromEntries(Object.entries(project.controlPanel.elements)
        .filter(([id]) => !removeIds.has(id))
        .map(([id, element]) => [
          id,
          element.type === 'group'
            ? { ...element, childIds: element.childIds.filter((childId) => !removeIds.has(childId)) }
            : removeIds.has(element.groupId ?? '') ? { ...element, groupId: undefined } : element
        ])),
      elementOrder: project.controlPanel.elementOrder.filter((id) => !removeIds.has(id))
    }
  }, elementIds.map((id) => deleted('control-panel-element', id, `/controlPanel/elements/${id}`, project.controlPanel.elements[id])));
}

function groupControlElements(workspace: ApplicationWorkspace, elementIds: string[], context: ApplicationCommandContext): ProjectMutationResult {
  const project = workspace.project;
  const children = elementIds.map((id) => project.controlPanel.elements[id]).filter(Boolean);
  if (children.length < 2) {
    return noChange(workspace);
  }
  const id = context.createId(project.controlPanel.elements, 'group');
  const left = Math.min(...children.map((element) => element.x));
  const top = Math.min(...children.map((element) => element.y));
  const right = Math.max(...children.map((element) => element.x + element.width));
  const bottom = Math.max(...children.map((element) => element.y + element.height));
  const group: ControlPanelElement = { id, type: 'group', name: `Group ${id}`, childIds: [...elementIds], x: left, y: top, width: right - left, height: bottom - top, rotation: 0, locked: false, visible: true };
  const elements = Object.fromEntries(Object.entries(project.controlPanel.elements).map(([key, element]) => [
    key,
    elementIds.includes(key) ? { ...element, groupId: id } : element
  ]));
  return changedProject(workspace, {
    ...project,
    meta: { ...project.meta, updatedAt: context.now() },
    controlPanel: { ...project.controlPanel, elements: { ...elements, [id]: group }, elementOrder: [...project.controlPanel.elementOrder, id] }
  }, [created('control-panel-element', id, `/controlPanel/elements/${id}`, group)]);
}

function ungroupControlElements(workspace: ApplicationWorkspace, elementIds: string[], context: ApplicationCommandContext): ProjectMutationResult {
  const project = workspace.project;
  const groupIds = new Set(elementIds.filter((id) => project.controlPanel.elements[id]?.type === 'group'));
  return changedProject(workspace, {
    ...project,
    meta: { ...project.meta, updatedAt: context.now() },
    controlPanel: {
      ...project.controlPanel,
      elements: Object.fromEntries(Object.entries(project.controlPanel.elements)
        .filter(([id]) => !groupIds.has(id))
        .map(([id, element]) => [id, element.groupId && groupIds.has(element.groupId) ? { ...element, groupId: undefined } : element])),
      elementOrder: project.controlPanel.elementOrder.filter((id) => !groupIds.has(id))
    }
  }, Array.from(groupIds).map((id) => deleted('control-panel-element', id, `/controlPanel/elements/${id}`, project.controlPanel.elements[id])));
}

function alignControlElements(workspace: ApplicationWorkspace, elementIds: string[], axis: 'left' | 'top' | 'center-x' | 'center-y', context: ApplicationCommandContext): ProjectMutationResult {
  const project = workspace.project;
  const selected = elementIds.map((id) => project.controlPanel.elements[id]).filter(Boolean);
  if (selected.length < 2) {
    return noChange(workspace);
  }
  const anchor = selected[0];
  const elements = { ...project.controlPanel.elements };
  selected.slice(1).forEach((element) => {
    const updates = axis === 'left'
      ? { x: anchor.x }
      : axis === 'top'
        ? { y: anchor.y }
        : axis === 'center-x'
          ? { x: Math.round(anchor.x + anchor.width / 2 - element.width / 2) }
          : { y: Math.round(anchor.y + anchor.height / 2 - element.height / 2) };
    elements[element.id] = { ...element, ...updates };
  });
  return changedProject(workspace, {
    ...project,
    meta: { ...project.meta, updatedAt: context.now() },
    controlPanel: { ...project.controlPanel, elements }
  }, selected.slice(1).map((element) => ({ kind: 'updated', entityType: 'control-panel-element', entityId: element.id, path: `/controlPanel/elements/${element.id}`, before: element, after: elements[element.id] })));
}

function updateControlPanelSettings(workspace: ApplicationWorkspace, updates: Partial<Pick<LcdBitmapProject['controlPanel'], 'width' | 'height' | 'gridEnabled' | 'snapToGrid' | 'gridSize' | 'backgroundColor'>>, context: ApplicationCommandContext): ProjectMutationResult {
  const project = workspace.project;
  const nextPanel = { ...project.controlPanel, ...updates };
  return changedProject(workspace, {
    ...project,
    meta: { ...project.meta, updatedAt: context.now() },
    controlPanel: nextPanel
  }, [{ kind: 'updated', entityType: 'control-panel', entityId: 'controlPanel', path: '/controlPanel', before: project.controlPanel, after: nextPanel }]);
}

function updateCanvasObject(workspace: ApplicationWorkspace, screenId: string, object: CanvasObject, context: ApplicationCommandContext): ProjectMutationResult {
  return updateScreen(workspace, screenId, context, (screen) => ({
    ...screen,
    objects: screen.objects.map((existing) => existing.id === object.id ? object : existing),
    updatedAt: context.now()
  }), [{ kind: 'updated', entityType: 'canvas-object', entityId: object.id, path: `/screens/${screenId}/objects/${object.id}`, after: object }]);
}

function setCanvasSelection(workspace: ApplicationWorkspace, screenId: string, objectIds: string[]): ProjectMutationResult {
  const project = workspace.project;
  const screen = project.screens[screenId];
  if (!screen) {
    return noChange(workspace);
  }
  const nextScreen = { ...screen, selectedObjectIds: objectIds };
  return changedProject(workspace, {
    ...project,
    screens: { ...project.screens, [screenId]: nextScreen }
  }, [{ kind: 'updated', entityType: 'screen', entityId: screenId, path: `/screens/${screenId}/selectedObjectIds`, before: screen.selectedObjectIds, after: objectIds }]);
}

function addCanvasObject(workspace: ApplicationWorkspace, screenId: string, object: CanvasObject, context: ApplicationCommandContext): ProjectMutationResult {
  return updateScreen(workspace, screenId, context, (screen) => ({
    ...screen,
    objects: [...screen.objects, object],
    selectedObjectIds: [object.id],
    updatedAt: context.now()
  }), [created('canvas-object', object.id, `/screens/${screenId}/objects/${object.id}`, object)]);
}

function addBitmapLayer(workspace: ApplicationWorkspace, screenId: string, name: string, bytes: number[], context: ApplicationCommandContext): ProjectMutationResult {
  const screen = workspace.project.screens[screenId];
  if (!screen) {
    return noChange(workspace);
  }
  const numericTimestamp = Date.parse(context.now());
  const object: CanvasObject = {
    id: `canvas-${screenId}-bitmap-${Number.isFinite(numericTimestamp) ? numericTimestamp : Date.now()}`,
    type: 'bitmap',
    name,
    x: 0,
    y: 0,
    width: screen.width,
    height: screen.height,
    bytes,
    zIndex: screen.objects.length,
    visible: true,
    locked: false,
    source: 'user'
  };
  return addCanvasObject(workspace, screenId, object, context);
}

function updateCanvasObjects(workspace: ApplicationWorkspace, screenId: string, objects: CanvasObject[], context: ApplicationCommandContext): ProjectMutationResult {
  return updateScreen(workspace, screenId, context, (screen) => ({ ...screen, objects, updatedAt: context.now() }), [{
    kind: 'updated',
    entityType: 'screen',
    entityId: screenId,
    path: `/screens/${screenId}/objects`,
    after: objects
  }]);
}

function deleteCanvasObjects(workspace: ApplicationWorkspace, screenId: string, objectIds: string[], context: ApplicationCommandContext): ProjectMutationResult {
  const removeIds = new Set(objectIds);
  return updateScreen(workspace, screenId, context, (screen) => ({
    ...screen,
    objects: screen.objects.filter((object) => !removeIds.has(object.id)),
    selectedObjectIds: [],
    updatedAt: context.now()
  }), objectIds.map((id) => deleted('canvas-object', id, `/screens/${screenId}/objects/${id}`, workspace.project.screens[screenId]?.objects.find((object) => object.id === id))));
}

function updateGlyph(workspace: ApplicationWorkspace, variant: keyof FontGlyphs, char: string, glyph: FontGlyphs[keyof FontGlyphs][string]): ProjectMutationResult {
  return changedWorkspace({
    ...workspace,
    fontGlyphs: { ...workspace.fontGlyphs, [variant]: { ...workspace.fontGlyphs[variant], [char]: glyph } }
  }, [{
    kind: 'updated',
    entityType: 'font-glyph',
    entityId: `${variant}:${char}`,
    path: `/fontGlyphs/${variant}/${char}`,
    before: workspace.fontGlyphs[variant][char],
    after: glyph
  }]);
}

function importFontGlyphs(
  workspace: ApplicationWorkspace,
  variant: keyof FontGlyphs,
  glyphs: FontGlyphs[keyof FontGlyphs],
  metadata: ApplicationWorkspace['loadedFonts'][number],
  mode: 'merge' | 'replace'
): ProjectMutationResult {
  const nextGlyphs = {
    ...workspace.fontGlyphs,
    [variant]: mode === 'replace' ? { ...glyphs } : { ...workspace.fontGlyphs[variant], ...glyphs }
  };
  return changedWorkspace({
    ...workspace,
    fontGlyphs: nextGlyphs,
    loadedFonts: [metadata, ...workspace.loadedFonts.filter((font) => font.id !== metadata.id && font.variant !== variant)]
  }, [{
    kind: 'updated',
    entityType: 'font',
    entityId: metadata.id,
    path: `/fontGlyphs/${variant}`,
    before: workspace.fontGlyphs[variant],
    after: nextGlyphs[variant]
  }]);
}

function addSavedMeasurement(workspace: ApplicationWorkspace, stateId: string, label: string, value: string, context: ApplicationCommandContext): ProjectMutationResult {
  const timestamp = context.now();
  const numericTimestamp = Date.parse(timestamp);
  const measurement = {
    id: `measurement-${Number.isFinite(numericTimestamp) ? numericTimestamp : Date.now()}`,
    stateId,
    label,
    value,
    note: '',
    createdAt: timestamp,
    updatedAt: timestamp
  };
  return changedWorkspace({ ...workspace, savedMeasurements: [measurement, ...workspace.savedMeasurements] }, [
    created('measurement', measurement.id, `/savedMeasurements/${measurement.id}`, measurement)
  ]);
}

function updateSavedMeasurement(workspace: ApplicationWorkspace, measurement: ApplicationWorkspace['savedMeasurements'][number], context: ApplicationCommandContext): ProjectMutationResult {
  return changedWorkspace({
    ...workspace,
    savedMeasurements: workspace.savedMeasurements.map((item) => item.id === measurement.id ? { ...measurement, updatedAt: context.now() } : item)
  }, [{ kind: 'updated', entityType: 'measurement', entityId: measurement.id, path: `/savedMeasurements/${measurement.id}`, after: measurement }]);
}

function deleteSavedMeasurement(workspace: ApplicationWorkspace, measurementId: string): ProjectMutationResult {
  return changedWorkspace({
    ...workspace,
    savedMeasurements: workspace.savedMeasurements.filter((item) => item.id !== measurementId)
  }, [deleted('measurement', measurementId, `/savedMeasurements/${measurementId}`, workspace.savedMeasurements.find((item) => item.id === measurementId))]);
}

function updateScreen(
  workspace: ApplicationWorkspace,
  screenId: string,
  context: ApplicationCommandContext,
  update: (screen: LcdScreen) => LcdScreen,
  changes: SemanticChange[]
): ProjectMutationResult {
  const project = workspace.project;
  const screen = project.screens[screenId];
  if (!screen) {
    return noChange(workspace);
  }
  return changedProject(workspace, {
    ...project,
    meta: { ...project.meta, updatedAt: context.now() },
    screens: { ...project.screens, [screenId]: update(screen) }
  }, changes);
}

function createState(project: LcdBitmapProject, id: string, title: string, screenId: string): FsmState {
  return {
    id,
    runtimeId: null,
    legacyIds: [],
    title,
    subsystem: 'user',
    stateType: project.fsm.stateOrder.length === 0 ? 'initial' : 'process',
    origin: 'user',
    screenId,
    initial: project.fsm.stateOrder.length === 0,
    terminal: false
  };
}

function createLcdScreen(project: LcdBitmapProject, id: string, name: string, timestamp: string): LcdScreen {
  return { id, name, description: '', tags: [], width: project.display.width, height: project.display.height, objects: [], selectedObjectIds: [], createdAt: timestamp, updatedAt: timestamp };
}

function createControlElement(project: LcdBitmapProject, id: string, type: ControlPanelElement['type']): ControlPanelElement {
  const base = { id, x: 80 + (project.controlPanel.elementOrder.length % 5) * 24, y: 80 + (project.controlPanel.elementOrder.length % 5) * 24, width: 100, height: 48, rotation: 0, locked: false, visible: true };
  if (type === 'button') {
    return { ...base, type, label: 'Button', shape: 'rounded-rect', pressType: 'short', repeatMode: false };
  }
  if (type === 'display') {
    return { ...base, type, width: project.display.width * 3, height: project.display.height * 3, screenScale: 3 };
  }
  if (type === 'text') {
    return { ...base, type, text: { en: 'Label', ru: 'РќР°РґРїРёСЃСЊ', zh: 'ж ‡з­ѕ' }, width: 140, height: 30 };
  }
  if (type === 'rectangle') {
    return { ...base, type, fillColor: 'transparent', strokeColor: project.controlPanel.tokens.panelStroke };
  }
  if (type === 'image') {
    return { ...base, type, name: 'Image', dataUrl: '', opacity: 1, width: 160, height: 100 };
  }
  return { ...base, type, name: 'Group', childIds: [] };
}

function changedProject(workspace: ApplicationWorkspace, project: LcdBitmapProject, changes: SemanticChange[]): ProjectMutationResult {
  return changedWorkspace({ ...workspace, project }, changes);
}

function changedWorkspace(workspace: ApplicationWorkspace, changes: SemanticChange[]): ProjectMutationResult {
  return { workspace, changes };
}

function noChange(workspace: ApplicationWorkspace): ProjectMutationResult {
  return { workspace, changes: [] };
}

function createScreenId(project: LcdBitmapProject, name?: string): string {
  const base = slug(name || 'screen');
  let id = base;
  let suffix = 2;
  while (project.screens[id]) {
    id = `${base}-${suffix++}`;
  }
  return id;
}

function createGraphPosition(index: number): { x: number; y: number } {
  return { x: 80 + (index % 4) * 190, y: 80 + Math.floor(index / 4) * 120 };
}

function created(entityType: SemanticChange['entityType'], entityId: string, path: string, after: unknown): SemanticChange {
  return { kind: 'created', entityType, entityId, path, after };
}

function deleted(entityType: SemanticChange['entityType'], entityId: string, path: string, before: unknown): SemanticChange {
  return { kind: 'deleted', entityType, entityId, path, before };
}

function omit<T>(record: Record<string, T>, id: string): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => key !== id));
}

function normalizeOrder(requested: string[], existing: string[]): string[] {
  const known = new Set(existing);
  const result = requested.filter((id) => known.has(id));
  existing.forEach((id) => {
    if (!result.includes(id)) {
      result.push(id);
    }
  });
  return result;
}

function insertAfter(values: string[], target: string, value: string): string[] {
  const index = values.indexOf(target);
  return index < 0 ? [...values, value] : [...values.slice(0, index + 1), value, ...values.slice(index + 1)];
}

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function pick<T extends object, Key extends keyof T>(value: T, keys: Key[]): Pick<T, Key> {
  return Object.fromEntries(keys.map((key) => [key, value[key]])) as Pick<T, Key>;
}
