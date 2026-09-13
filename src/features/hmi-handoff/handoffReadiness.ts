import type { ControlPanelButton, LcdBitmapProject } from '../../domain';

export interface HandoffReadiness {
  ready: boolean;
  validationErrors: number;
  validationWarnings: number;
  statesWithoutScreens: number;
  unboundButtons: number;
  unroutedButtons: number;
  untranslatedTexts: number;
}

export function assessHandoffReadiness(project: LcdBitmapProject): HandoffReadiness {
  const validationErrors = project.validation.issues.filter((issue) => issue.severity === 'error').length;
  const validationWarnings = project.validation.issues.filter((issue) => issue.severity === 'warning').length;
  const statesWithoutScreens = project.fsm.stateOrder.filter((id) => {
    const screenId = project.fsm.states[id]?.screenId;
    return !screenId || !project.screens[screenId];
  }).length;
  const buttons = project.controlPanel.elementOrder
    .map((id) => project.controlPanel.elements[id])
    .filter((element): element is ControlPanelButton => element?.type === 'button' && element.visible);
  const unboundButtons = buttons.filter((button) => !button.fsmEventId && !button.bindings?.eventId).length;
  const unroutedButtons = buttons.filter((button) => {
    const eventId = button.fsmEventId ?? button.bindings?.eventId;
    return Boolean(eventId) && !project.fsm.transitionOrder.some((id) => project.fsm.transitions[id]?.trigger.eventId === eventId);
  }).length;
  const untranslatedTexts = project.screenOrder.reduce((count, screenId) => (
    count + (project.screens[screenId]?.objects.filter((object) => (
      object.type === 'text' && (!object.text.ru.trim() || !object.text.en.trim() || !(object.text.zh ?? '').trim())
    )).length ?? 0)
  ), 0);
  return {
    ready: validationErrors + statesWithoutScreens + unboundButtons + unroutedButtons + untranslatedTexts === 0,
    validationErrors,
    validationWarnings,
    statesWithoutScreens,
    unboundButtons,
    unroutedButtons,
    untranslatedTexts
  };
}
