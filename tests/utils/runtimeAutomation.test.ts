import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fireAutomationRuntimeEvent,
  getAutomationRuntimeState,
  registerRuntimeAutomationHandler,
  setAutomationRuntimeTag,
  type RuntimeAutomationAdapter
} from '../../src/renderer/automation/runtimeAutomation';

describe('runtime automation singleton adapter', () => {
  let unregister: (() => void) | null = null;

  afterEach(() => {
    unregister?.();
    unregister = null;
  });

  function registerFakeAdapter(overrides: Partial<RuntimeAutomationAdapter> = {}): RuntimeAutomationAdapter {
    const adapter: RuntimeAutomationAdapter = {
      fireEvent: vi.fn(),
      setTag: vi.fn(),
      getState: () => ({ currentStateId: 'main-menu', isRunning: true, hardwareNotification: null }),
      ...overrides
    };
    unregister = registerRuntimeAutomationHandler(adapter);
    return adapter;
  }

  it('reports an inactive default state when no workspace is registered', () => {
    expect(getAutomationRuntimeState()).toEqual({ currentStateId: null, isRunning: false, hardwareNotification: null });
  });

  it('throws when firing an event or setting a tag before a workspace is registered', async () => {
    await expect(fireAutomationRuntimeEvent('START')).rejects.toThrow('Runtime workspace is not active');
    await expect(setAutomationRuntimeTag('io.usb_present', true)).rejects.toThrow('Runtime workspace is not active');
  });

  it('delegates fireEvent, setTag and getState to the registered adapter', async () => {
    const adapter = registerFakeAdapter();

    await fireAutomationRuntimeEvent('START');
    expect(adapter.fireEvent).toHaveBeenCalledWith('START');

    await setAutomationRuntimeTag('io.usb_present', true);
    expect(adapter.setTag).toHaveBeenCalledWith('io.usb_present', true);

    expect(getAutomationRuntimeState()).toEqual({ currentStateId: 'main-menu', isRunning: true, hardwareNotification: null });
  });

  it('surfaces the active hardware notification through getState', () => {
    const notification = { equipment: 'usb' as const, present: true, screenId: 'measure', returnStateId: 'main-menu', openedAt: 1 };
    registerFakeAdapter({ getState: () => ({ currentStateId: 'main-menu', isRunning: true, hardwareNotification: notification }) });

    expect(getAutomationRuntimeState().hardwareNotification).toEqual(notification);
  });

  it('falls back to the inactive default once the workspace unregisters', () => {
    registerFakeAdapter();
    unregister?.();
    unregister = null;

    expect(getAutomationRuntimeState()).toEqual({ currentStateId: null, isRunning: false, hardwareNotification: null });
  });

  it('does not let a stale unregister callback clear a newer adapter', () => {
    const firstUnregister = registerRuntimeAutomationHandler({
      fireEvent: vi.fn(),
      setTag: vi.fn(),
      getState: () => ({ currentStateId: 'a', isRunning: true, hardwareNotification: null })
    });
    registerFakeAdapter();

    firstUnregister();

    expect(getAutomationRuntimeState().currentStateId).toBe('main-menu');
  });
});
