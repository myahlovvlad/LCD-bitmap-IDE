import { beforeEach, describe, expect, it } from 'vitest';
import {
  beginOperation,
  notify,
  resetNotificationStoreForTests,
  useNotificationStore
} from '../../src/renderer/notifications/notificationStore';

describe('notification and operation feedback store', () => {
  beforeEach(() => resetNotificationStoreForTests());

  it('records notifications with unread history and explicit source', () => {
    const id = notify({ title: 'Project opened', tone: 'success', source: 'project-file' });
    const state = useNotificationStore.getState();

    expect(state.notifications).toEqual([
      expect.objectContaining({ id, title: 'Project opened', tone: 'success', source: 'project-file', read: false })
    ]);

    state.dismiss(id);
    expect(useNotificationStore.getState().notifications[0]).toMatchObject({ dismissed: true, read: true });
  });

  it('moves one operation from running to a verifiable outcome', () => {
    const operation = beginOperation('Compile assets', { source: 'compiler' });
    expect(useNotificationStore.getState().notifications[0]).toMatchObject({ status: 'running', persistent: true });

    operation.succeed('Assets compiled', '3 artifacts');
    expect(useNotificationStore.getState().notifications[0]).toMatchObject({
      id: operation.id,
      status: 'success',
      tone: 'success',
      message: '3 artifacts',
      persistent: false
    });
  });

  it('deduplicates recurring failures instead of flooding the operator', () => {
    notify({ title: 'Autosave failed', tone: 'danger', dedupeKey: 'autosave' });
    notify({ title: 'Autosave still unavailable', tone: 'danger', dedupeKey: 'autosave' });

    expect(useNotificationStore.getState().notifications).toHaveLength(1);
    expect(useNotificationStore.getState().notifications[0].title).toBe('Autosave still unavailable');
  });
});
