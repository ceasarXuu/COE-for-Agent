import { useSyncExternalStore } from 'react';

export interface UIState {
  revision: number | null;
  selectedNodeId: string | null;
}

export function createUIStore(initialState: UIState = {
  revision: null,
  selectedNodeId: null
}) {
  let state: UIState = initialState;
  const listeners = new Set<() => void>();

  function emitChange() {
    for (const listener of listeners) {
      listener();
    }
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function snapshot(): UIState {
    return state;
  }

  return {
    getState: snapshot,
    setRevision(revision: number | null) {
      state = {
        ...state,
        revision
      };
      emitChange();
    },
    setSelectedNodeId(selectedNodeId: string | null) {
      state = {
        ...state,
        selectedNodeId
      };
      emitChange();
    },
    resetUIState() {
      state = {
        revision: null,
        selectedNodeId: null
      };
      emitChange();
    },
    useStore<T>(selector: (nextState: UIState) => T): T {
      return useSyncExternalStore(subscribe, () => selector(snapshot()), () => selector(snapshot()));
    }
  };
}

const defaultStore = createUIStore();

export const getUIState = defaultStore.getState;
export const setRevision = defaultStore.setRevision;
export const setSelectedNodeId = defaultStore.setSelectedNodeId;
export const resetUIState = defaultStore.resetUIState;
export const useUIStore = defaultStore.useStore;
