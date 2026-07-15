import type React from 'react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { WorkspaceLocation } from '../domain/project';

export interface WorkspaceRouterApi {
  location: WorkspaceLocation;
  navigate: (location: WorkspaceLocation) => void;
}

const WorkspaceRouterContext = createContext<WorkspaceRouterApi | null>(null);

export function WorkspaceRouterProvider({
  children,
  initialLocation = { mode: 'fsm' }
}: {
  children: React.ReactNode;
  initialLocation?: WorkspaceLocation;
}): React.ReactElement {
  const [location, setLocation] = useState<WorkspaceLocation>(initialLocation);
  const navigate = useCallback((next: WorkspaceLocation) => setLocation(next), []);
  const value = useMemo(() => ({ location, navigate }), [location, navigate]);
  return (
    <WorkspaceRouterContext.Provider value={value}>
      {children}
    </WorkspaceRouterContext.Provider>
  );
}

export function useWorkspaceRouter(): WorkspaceRouterApi {
  const router = useContext(WorkspaceRouterContext);
  if (!router) {
    throw new Error('useWorkspaceRouter must be used inside WorkspaceRouterProvider.');
  }
  return router;
}
