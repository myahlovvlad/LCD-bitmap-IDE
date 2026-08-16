export interface UiAutomationParityEntry {
  uiCommand: string;
  automationCommands?: string[];
  uiOnlyReason?: string;
}

const mapped = (uiCommand: string, ...automationCommands: string[]): UiAutomationParityEntry => ({
  uiCommand,
  automationCommands
});
const uiOnly = (uiCommand: string, uiOnlyReason: string): UiAutomationParityEntry => ({
  uiCommand,
  uiOnlyReason
});

/** Every public application command must be mapped or carry a reviewable UI-only reason. */
export const UI_AUTOMATION_PARITY: readonly UiAutomationParityEntry[] = [
  uiOnly('project.updateMetadata', 'Project identity editing remains a user-confirmed settings workflow.'),
  uiOnly('project.updateDisplayConfig', 'Display configuration is withheld until the versioned DisplayProfile contract lands.'),
  mapped('project.setAuthoringLanguage', 'set_authoring_language'),
  mapped('fsm.state.add', 'create_fsm_state'),
  mapped('fsm.state.update', 'update_fsm_state'),
  uiOnly('fsm.states.update', 'Bulk layer membership editing requires the planned semantic batch schema.'),
  uiOnly('fsm.layers.update', 'Layer registry editing is not yet a stable public automation contract.'),
  mapped('fsm.state.delete', 'delete_fsm_state'),
  uiOnly('fsm.state.ensureScreen', 'Internal repair command used by the visual workspace.'),
  mapped('fsm.transition.add', 'create_fsm_transition'),
  mapped('fsm.transition.update', 'update_fsm_transition'),
  mapped('fsm.transition.delete', 'delete_fsm_transition'),
  mapped('fsm.event.add', 'create_fsm_event'),
  mapped('fsm.event.update', 'update_fsm_event'),
  mapped('fsm.event.delete', 'delete_fsm_event'),
  uiOnly('backendProcess.update', 'Backend process editing requires a dedicated bounded action schema.'),
  uiOnly('fsm.graphPosition.update', 'High-frequency direct canvas dragging is intentionally UI-only.'),
  mapped('fsm.graphPositions.update', 'auto_layout_fsm'),
  uiOnly('fsm.semanticRoundTrip.apply', 'FSM interchange uses its own preview/apply transaction facade.'),
  mapped('screen.create', 'create_screen'),
  uiOnly('screen.duplicate', 'Duplicate semantics will be exposed with the screen catalog milestone.'),
  uiOnly('screen.duplicateLayout', 'Layout-only duplication requires an explicit resource-sharing contract.'),
  mapped('screen.rename', 'update_screen'),
  mapped('screen.resize', 'update_screen'),
  mapped('screen.delete', 'delete_screen'),
  mapped('screen.reorder', 'reorder_screens'),
  uiOnly('screen.createFromTemplate', 'Template identity is local UI state until the template registry milestone.'),
  uiOnly('screen.dsl.apply', 'Screen DSL already has a dedicated preview and atomic apply facade.'),
  uiOnly('controlPanel.element.add', 'Control-panel creation needs a versioned element schema.'),
  mapped('controlPanel.element.update', 'update_control_panel_element'),
  uiOnly('controlPanel.elements.update', 'Bulk drag/resize is a high-frequency UI gesture.'),
  uiOnly('controlPanel.elements.delete', 'Bulk destructive control-panel editing needs explicit confirmation semantics.'),
  uiOnly('controlPanel.elements.group', 'Grouping is not yet part of the stable automation schema.'),
  uiOnly('controlPanel.elements.ungroup', 'Grouping is not yet part of the stable automation schema.'),
  uiOnly('controlPanel.elements.align', 'Alignment is a visual editor gesture.'),
  uiOnly('controlPanel.settings.update', 'Panel geometry changes require a device-profile contract.'),
  uiOnly('canvas.object.update', 'Pixel/canvas mutations are withheld until canonical raster preview contracts land.'),
  uiOnly('canvas.selection.set', 'Selection is ephemeral UI state.'),
  uiOnly('canvas.object.add', 'Pixel/canvas mutations are withheld until canonical raster preview contracts land.'),
  uiOnly('canvas.bitmapLayer.add', 'Binary layer import uses the guarded import pipeline.'),
  uiOnly('canvas.objects.update', 'Bulk canvas gesture updates are intentionally UI-only.'),
  uiOnly('canvas.objects.delete', 'Canvas deletion needs the future canonical raster preview contract.'),
  uiOnly('font.glyph.update', 'Glyph pixel editing is an interactive UI workflow.'),
  uiOnly('font.glyphs.import', 'Font import is file-backed and requires explicit user file selection.'),
  uiOnly('measurement.add', 'Saved measurements remain local operator records.'),
  uiOnly('measurement.update', 'Saved measurements remain local operator records.'),
  uiOnly('measurement.delete', 'Saved measurements remain local operator records.'),
  mapped('tag.upsert', 'upsert_tag'),
  mapped('tag.delete', 'delete_tag'),
  mapped('procedure.upsert', 'upsert_procedure'),
  mapped('procedure.delete', 'delete_procedure'),
  mapped('alarm.upsert', 'upsert_alarm'),
  mapped('alarm.delete', 'delete_alarm')
] as const;
