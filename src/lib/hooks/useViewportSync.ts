import { writable } from 'svelte/store';

export interface ViewportState {
  scale: number;
  x: number;
  y: number;
}

export interface UseViewportSyncOptions {
  initialLeft?: ViewportState;
  initialRight?: ViewportState;
  syncEnabled?: boolean;
}

export interface UseViewportSyncReturn {
  leftViewport: typeof leftViewport;
  rightViewport: typeof rightViewport;
  syncEnabled: typeof syncEnabled;
  isLeftChanging: typeof isLeftChanging;
  isRightChanging: typeof isRightChanging;
  setSyncEnabled: (enabled: boolean) => void;
  handleLeftViewportChange: (viewport: ViewportState) => void;
  handleRightViewportChange: (viewport: ViewportState) => void;
  reset: (left?: ViewportState, right?: ViewportState) => void;
}

export function useViewportSync(
  options: UseViewportSyncOptions = {}
): UseViewportSyncReturn {
  const {
    initialLeft = { scale: 1, x: 0, y: 0 },
    initialRight = { scale: 1, x: 0, y: 0 },
    syncEnabled: initialSyncEnabled = true,
  } = options;

  const leftViewport = writable<ViewportState>(initialLeft);
  const rightViewport = writable<ViewportState>(initialRight);
  const syncEnabled = writable<boolean>(initialSyncEnabled);
  const isLeftChanging = writable<boolean>(false);
  const isRightChanging = writable<boolean>(false);

  function setSyncEnabled(enabled: boolean) {
    syncEnabled.set(enabled);
  }

  function handleLeftViewportChange(viewport: ViewportState) {
    let shouldSync = true;
    let rightChanging = false;
    const unsub1 = syncEnabled.subscribe((v) => (shouldSync = v));
    const unsub2 = isRightChanging.subscribe((v) => (rightChanging = v));
    unsub1();
    unsub2();

    if (!shouldSync || rightChanging) return;

    isLeftChanging.set(true);
    leftViewport.set(viewport);
    rightViewport.set(viewport);

    requestAnimationFrame(() => {
      isLeftChanging.set(false);
    });
  }

  function handleRightViewportChange(viewport: ViewportState) {
    let shouldSync = true;
    let leftChanging = false;
    const unsub1 = syncEnabled.subscribe((v) => (shouldSync = v));
    const unsub2 = isLeftChanging.subscribe((v) => (leftChanging = v));
    unsub1();
    unsub2();

    if (!shouldSync || leftChanging) return;

    isRightChanging.set(true);
    rightViewport.set(viewport);
    leftViewport.set(viewport);

    requestAnimationFrame(() => {
      isRightChanging.set(false);
    });
  }

  function reset(left: ViewportState = { scale: 1, x: 0, y: 0 }, right: ViewportState = { scale: 1, x: 0, y: 0 }) {
    leftViewport.set(left);
    rightViewport.set(right);
  }

  return {
    leftViewport,
    rightViewport,
    syncEnabled,
    isLeftChanging,
    isRightChanging,
    setSyncEnabled,
    handleLeftViewportChange,
    handleRightViewportChange,
    reset,
  };
}
