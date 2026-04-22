import { createUIStore } from '@coe/console-client/ui-store';

const uiStore = createUIStore();

export const getUIState = uiStore.getState;
export const setRevision = uiStore.setRevision;
export const setSelectedNodeId = uiStore.setSelectedNodeId;
export const resetUIState = uiStore.resetUIState;
export const useUIStore = uiStore.useStore;
