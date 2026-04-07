import { useSyncExternalStore } from 'react';

interface UIState {
  revision: number | null;
  selectedNodeId: string | null;
}

let state: UIState = {
  revision: null,
  selectedNodeId: null
};

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

export function setRevision(revision: number | null) {
  state = {
    ...state,
    revision
  };
  emitChange();
}

export function setSelectedNodeId(selectedNodeId: string | null) {
  state = {
    ...state,
    selectedNodeId
  };
  emitChange();
}

export function resetUIState() {
  state = {
    revision: null,
    selectedNodeId: null
  };
  emitChange();
}

export function useUIStore<T>(selector: (state: UIState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(snapshot()), () => selector(snapshot()));
}