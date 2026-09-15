import type { HardwareNotification } from '../../services/runtimeHardwareNotifications';
import type { TagValue } from '../../services/runtime/TagContext';

export interface RuntimeAutomationState {
  currentStateId: string | null;
  isRunning: boolean;
  hardwareNotification: HardwareNotification | null;
}

export interface RuntimeAutomationAdapter {
  fireEvent: (eventId: string) => void | Promise<void>;
  setTag: (tagId: string, value: TagValue) => void | Promise<void>;
  getState: () => RuntimeAutomationState;
}

let runtimeAdapter: RuntimeAutomationAdapter | null = null;

export function registerRuntimeAutomationHandler(adapter: RuntimeAutomationAdapter): () => void {
  runtimeAdapter = adapter;
  return () => {
    if (runtimeAdapter === adapter) runtimeAdapter = null;
  };
}

export async function fireAutomationRuntimeEvent(eventId: string): Promise<void> {
  if (!runtimeAdapter) throw new Error('Runtime workspace is not active');
  await runtimeAdapter.fireEvent(eventId);
}

export async function setAutomationRuntimeTag(tagId: string, value: TagValue): Promise<void> {
  if (!runtimeAdapter) throw new Error('Runtime workspace is not active');
  await runtimeAdapter.setTag(tagId, value);
}

export function getAutomationRuntimeState(): RuntimeAutomationState {
  return runtimeAdapter?.getState() ?? { currentStateId: null, isRunning: false, hardwareNotification: null };
}
