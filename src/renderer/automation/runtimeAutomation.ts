export interface RuntimeAutomationAdapter {
  fireEvent: (eventId: string) => void | Promise<void>;
  getState: () => { currentStateId: string | null; isRunning: boolean };
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

export function getAutomationRuntimeState(): { currentStateId: string | null; isRunning: boolean } {
  return runtimeAdapter?.getState() ?? { currentStateId: null, isRunning: false };
}
