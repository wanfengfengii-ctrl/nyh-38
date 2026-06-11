import { writable, derived, get } from 'svelte/store';
import type { AnnotationType } from '@/types';

export type ToolMode = 'select' | 'pan' | AnnotationType;

export type SpliceMode = 'disabled' | 'select-first' | 'select-second';

export type SidePanelTab = 'scheme' | 'timeline' | 'evolution' | 'compare' | 'history';

interface UiState {
  toolMode: ToolMode;
  spliceMode: SpliceMode;
  selectedFragmentId: string | null;
  selectedAnnotationId: string | null;
  selectedSpliceFirstId: string | null;
  sidePanelTab: SidePanelTab;
  isSidePanelOpen: boolean;
  isLoading: boolean;
  error: string | null;
  success: string | null;
}

function createInitialState(): UiState {
  return {
    toolMode: 'select',
    spliceMode: 'disabled',
    selectedFragmentId: null,
    selectedAnnotationId: null,
    selectedSpliceFirstId: null,
    sidePanelTab: 'scheme',
    isSidePanelOpen: true,
    isLoading: false,
    error: null,
    success: null,
  };
}

function createUiStore() {
  const { subscribe, set, update } = writable<UiState>(createInitialState());

  return {
    subscribe,

    getState(): UiState {
      return get({ subscribe });
    },

    setToolMode(mode: ToolMode) {
      update((state) => ({ ...state, toolMode: mode, spliceMode: 'disabled', selectedSpliceFirstId: null }));
    },

    setSpliceMode(mode: SpliceMode) {
      update((state) => ({ ...state, spliceMode: mode }));
    },

    startSpliceMode() {
      update((state) => ({
        ...state,
        toolMode: 'select',
        spliceMode: 'select-first',
        selectedSpliceFirstId: null,
      }));
    },

    cancelSpliceMode() {
      update((state) => ({
        ...state,
        spliceMode: 'disabled',
        selectedSpliceFirstId: null,
      }));
    },

    setSpliceFirstFragment(fragmentId: string) {
      update((state) => ({
        ...state,
        selectedSpliceFirstId: fragmentId,
        spliceMode: 'select-second',
      }));
    },

    setSelectedFragment(id: string | null) {
      update((state) => ({
        ...state,
        selectedFragmentId: id,
        selectedAnnotationId: id ? null : state.selectedAnnotationId,
      }));
    },

    setSelectedAnnotation(id: string | null) {
      update((state) => ({
        ...state,
        selectedAnnotationId: id,
        selectedFragmentId: id ? null : state.selectedFragmentId,
      }));
    },

    clearSelection() {
      update((state) => ({
        ...state,
        selectedFragmentId: null,
        selectedAnnotationId: null,
        selectedSpliceFirstId: null,
      }));
    },

    setSidePanelTab(tab: SidePanelTab) {
      update((state) => ({ ...state, sidePanelTab: tab }));
    },

    toggleSidePanel() {
      update((state) => ({ ...state, isSidePanelOpen: !state.isSidePanelOpen }));
    },

    setSidePanelOpen(open: boolean) {
      update((state) => ({ ...state, isSidePanelOpen: open }));
    },

    showError(message: string) {
      update((state) => ({ ...state, error: message, success: null }));
    },

    showSuccess(message: string) {
      update((state) => ({ ...state, success: message, error: null }));
    },

    clearMessages() {
      update((state) => ({ ...state, error: null, success: null }));
    },

    setLoading(loading: boolean) {
      update((state) => ({ ...state, isLoading: loading }));
    },

    reset() {
      set(createInitialState());
    },
  };
}

export const uiStore = createUiStore();

export const isAnnotationTool = derived(uiStore, ($s) =>
  $s.toolMode === 'place' || $s.toolMode === 'river' || $s.toolMode === 'boundary' || $s.toolMode === 'note'
);

export const isPanTool = derived(uiStore, ($s) => $s.toolMode === 'pan');

export const isSelectTool = derived(uiStore, ($s) => $s.toolMode === 'select');

export const isSpliceActive = derived(uiStore, ($s) => $s.spliceMode !== 'disabled');
