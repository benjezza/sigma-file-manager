// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  computed,
  getCurrentScope,
  onScopeDispose,
  ref,
  type ComputedRef,
  type Ref,
} from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import normalizePath from '@/utils/normalize-path';

const MARQUEE_DRAG_START_THRESHOLD_PX = 4;

type MarqueeBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type ActiveMarqueeState = {
  startClientX: number;
  startClientY: number;
  additive: boolean;
  startedOnEntry: boolean;
  initialSelectionPaths: Set<string>;
  moved: boolean;
};

function hasEntryIntersection(
  entryRect: DOMRect,
  marqueeLeft: number,
  marqueeTop: number,
  marqueeRight: number,
  marqueeBottom: number,
): boolean {
  return !(
    entryRect.right < marqueeLeft
    || entryRect.left > marqueeRight
    || entryRect.bottom < marqueeTop
    || entryRect.top > marqueeBottom
  );
}

export function useFileBrowserMarqueeSelection(options: {
  entries: Ref<DirEntry[]>;
  selectedEntries: Ref<DirEntry[]>;
  entriesContainerRef: Ref<HTMLElement | null>;
  setSelection: (entries: DirEntry[]) => void;
  clearSelection: () => void;
  isEntryDragging: Ref<boolean>;
}) {
  const activeState = ref<ActiveMarqueeState | null>(null);
  const marqueeBounds = ref<MarqueeBounds | null>(null);
  const isMarqueeSelecting = ref(false);
  const shouldSuppressEntryDrag = computed(() => {
    return activeState.value?.startedOnEntry === true;
  });

  const marqueeSelectionStyle: ComputedRef<Record<string, string>> = computed(() => {
    const bounds = marqueeBounds.value;

    if (!isMarqueeSelecting.value || bounds === null) {
      return {} as Record<string, string>;
    }

    return {
      left: `${bounds.left}px`,
      top: `${bounds.top}px`,
      width: `${bounds.width}px`,
      height: `${bounds.height}px`,
    };
  });

  function applySelectionForClientPoint(clientX: number, clientY: number) {
    const state = activeState.value;
    const container = options.entriesContainerRef.value;

    if (state === null || container === null) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const marqueeLeft = Math.max(Math.min(state.startClientX, clientX), containerRect.left);
    const marqueeRight = Math.min(Math.max(state.startClientX, clientX), containerRect.right);
    const marqueeTop = Math.max(Math.min(state.startClientY, clientY), containerRect.top);
    const marqueeBottom = Math.min(Math.max(state.startClientY, clientY), containerRect.bottom);

    marqueeBounds.value = {
      left: marqueeLeft - containerRect.left,
      top: marqueeTop - containerRect.top,
      width: Math.max(0, marqueeRight - marqueeLeft),
      height: Math.max(0, marqueeBottom - marqueeTop),
    };

    const hitPaths = new Set<string>();
    const entryElements = container.querySelectorAll<HTMLElement>('[data-entry-path]');

    for (const entryElement of entryElements) {
      const entryPath = entryElement.dataset.entryPath;

      if (!entryPath) {
        continue;
      }

      const entryRect = entryElement.getBoundingClientRect();

      if (hasEntryIntersection(entryRect, marqueeLeft, marqueeTop, marqueeRight, marqueeBottom)) {
        hitPaths.add(normalizePath(entryPath));
      }
    }

    const nextPaths = state.additive
      ? new Set<string>(state.initialSelectionPaths)
      : new Set<string>();

    for (const path of hitPaths) {
      nextPaths.add(path);
    }

    const nextSelection = options.entries.value.filter((entry) => {
      return nextPaths.has(normalizePath(entry.path));
    });
    options.setSelection(nextSelection);
  }

  function stopMarqueeSelection() {
    window.removeEventListener('mousemove', handleWindowMouseMove);
    window.removeEventListener('mouseup', handleWindowMouseUp);
    activeState.value = null;
    marqueeBounds.value = null;
    isMarqueeSelecting.value = false;
  }

  function handleWindowMouseMove(event: MouseEvent) {
    const state = activeState.value;

    if (state === null) {
      return;
    }

    const deltaX = Math.abs(event.clientX - state.startClientX);
    const deltaY = Math.abs(event.clientY - state.startClientY);

    if (!state.moved && Math.max(deltaX, deltaY) >= MARQUEE_DRAG_START_THRESHOLD_PX) {
      state.moved = true;
      isMarqueeSelecting.value = true;
    }

    if (!state.moved) {
      return;
    }

    event.preventDefault();
    applySelectionForClientPoint(event.clientX, event.clientY);
  }

  function handleWindowMouseUp() {
    const state = activeState.value;

    if (state === null) {
      stopMarqueeSelection();
      return;
    }

    if (!state.moved && !state.additive && !state.startedOnEntry) {
      options.clearSelection();
    }

    stopMarqueeSelection();
  }

  function handleEntriesContainerMouseDown(event: MouseEvent) {
    if (event.button !== 0 || options.isEntryDragging.value) {
      return;
    }

    if (!(event.target instanceof Element)) {
      return;
    }

    const entryElement = event.target.closest<HTMLElement>('[data-entry-path]');
    const entryPath = entryElement?.dataset.entryPath;
    const normalizedEntryPath = entryPath ? normalizePath(entryPath) : null;

    if (
      normalizedEntryPath
      && options.selectedEntries.value.some(
        selectedEntry => normalizePath(selectedEntry.path) === normalizedEntryPath,
      )
    ) {
      return;
    }

    const container = options.entriesContainerRef.value;

    if (!container) {
      return;
    }

    const additive = event.ctrlKey || event.metaKey;
    const initialSelectionPaths = new Set<string>(
      options.selectedEntries.value.map(entry => normalizePath(entry.path)),
    );

    activeState.value = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      additive,
      startedOnEntry: !!normalizedEntryPath,
      initialSelectionPaths,
      moved: false,
    };
    marqueeBounds.value = {
      left: event.clientX - container.getBoundingClientRect().left,
      top: event.clientY - container.getBoundingClientRect().top,
      width: 0,
      height: 0,
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
  }

  if (getCurrentScope()) {
    onScopeDispose(() => {
      stopMarqueeSelection();
    });
  }

  return {
    isMarqueeSelecting,
    marqueeSelectionStyle,
    shouldSuppressEntryDrag,
    handleEntriesContainerMouseDown,
  };
}
