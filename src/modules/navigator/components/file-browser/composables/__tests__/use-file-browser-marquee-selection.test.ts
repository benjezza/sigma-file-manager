// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import { useFileBrowserMarqueeSelection } from '../use-file-browser-marquee-selection';

function createEntry(path: string): DirEntry {
  return {
    name: path.split('/').pop() || 'file.txt',
    ext: 'txt',
    path,
    size: 10,
    item_count: null,
    modified_time: 0,
    accessed_time: 0,
    created_time: 0,
    mime: 'text/plain',
    is_file: true,
    is_dir: false,
    is_symlink: false,
    is_hidden: false,
    link_type: null,
    link_target: null,
    link_status: null,
    hard_link_count: null,
  };
}

function createRect(left: number, top: number, right: number, bottom: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
    toJSON: () => ({}),
  } as DOMRect;
}

function createHarness(options: {
  initialSelection?: DirEntry[];
} = {}) {
  const container = document.createElement('div');
  const entries = ref<DirEntry[]>([
    createEntry('C:/Dir/a.txt'),
    createEntry('C:/Dir/b.txt'),
  ]);
  const selectedEntries = ref<DirEntry[]>(options.initialSelection ?? []);
  const entriesContainerRef = ref<HTMLElement | null>(container);
  const isEntryDragging = ref(false);
  const setSelection = vi.fn((nextEntries: DirEntry[]) => {
    selectedEntries.value = [...nextEntries];
  });
  const clearSelection = vi.fn(() => {
    selectedEntries.value = [];
  });

  document.body.appendChild(container);

  Object.defineProperty(container, 'getBoundingClientRect', {
    value: () => createRect(0, 0, 300, 300),
  });

  function appendEntryElement(path: string, rect: DOMRect) {
    const element = document.createElement('div');
    element.dataset.entryPath = path;

    Object.defineProperty(element, 'getBoundingClientRect', {
      value: () => rect,
    });

    entriesContainerRef.value?.appendChild(element);
    return element;
  }

  const entryElementA = appendEntryElement('C:/Dir/a.txt', createRect(12, 12, 60, 60));
  appendEntryElement('C:/Dir/b.txt', createRect(120, 120, 180, 180));

  const marquee = useFileBrowserMarqueeSelection({
    entries,
    selectedEntries,
    entriesContainerRef,
    setSelection,
    clearSelection,
    isEntryDragging,
  });

  return {
    entries,
    selectedEntries,
    entriesContainerRef,
    isEntryDragging,
    setSelection,
    clearSelection,
    entryElementA,
    marquee,
  };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('useFileBrowserMarqueeSelection', () => {
  it('selects intersecting entries when dragging on background', () => {
    const harness = createHarness();

    harness.marquee.handleEntriesContainerMouseDown({
      button: 0,
      clientX: 4,
      clientY: 4,
      ctrlKey: false,
      metaKey: false,
      target: harness.entriesContainerRef.value,
    } as unknown as MouseEvent);

    window.dispatchEvent(new MouseEvent('mousemove', {
      clientX: 170,
      clientY: 170,
      buttons: 1,
    }));

    expect(harness.marquee.isMarqueeSelecting.value).toBe(true);
    expect(harness.selectedEntries.value.map(entry => entry.path)).toEqual([
      'C:/Dir/a.txt',
      'C:/Dir/b.txt',
    ]);

    window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
  });

  it('adds to existing selection when ctrl-dragging', () => {
    const harness = createHarness({
      initialSelection: [createEntry('C:/Dir/a.txt')],
    });

    harness.marquee.handleEntriesContainerMouseDown({
      button: 0,
      clientX: 100,
      clientY: 100,
      ctrlKey: true,
      metaKey: false,
      target: harness.entriesContainerRef.value,
    } as unknown as MouseEvent);

    window.dispatchEvent(new MouseEvent('mousemove', {
      clientX: 200,
      clientY: 200,
      buttons: 1,
    }));

    expect(harness.selectedEntries.value.map(entry => entry.path)).toEqual([
      'C:/Dir/a.txt',
      'C:/Dir/b.txt',
    ]);

    window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
  });

  it('clears selection on background click without dragging', () => {
    const harness = createHarness({
      initialSelection: [createEntry('C:/Dir/a.txt')],
    });

    harness.marquee.handleEntriesContainerMouseDown({
      button: 0,
      clientX: 280,
      clientY: 280,
      ctrlKey: false,
      metaKey: false,
      target: harness.entriesContainerRef.value,
    } as unknown as MouseEvent);

    window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }));

    expect(harness.clearSelection).toHaveBeenCalledTimes(1);
    expect(harness.selectedEntries.value).toEqual([]);
  });

  it('does not arm marquee when mousedown starts on an already selected entry', () => {
    const harness = createHarness({
      initialSelection: [createEntry('C:/Dir/a.txt')],
    });

    harness.marquee.handleEntriesContainerMouseDown({
      button: 0,
      clientX: 20,
      clientY: 20,
      ctrlKey: false,
      metaKey: false,
      target: harness.entryElementA,
    } as unknown as MouseEvent);

    window.dispatchEvent(new MouseEvent('mousemove', {
      clientX: 200,
      clientY: 200,
      buttons: 1,
    }));

    expect(harness.setSelection).not.toHaveBeenCalled();
    expect(harness.selectedEntries.value.map(entry => entry.path)).toEqual(['C:/Dir/a.txt']);
  });

  it('arms marquee and suppresses entry drag when mousedown starts on an unselected entry', () => {
    const harness = createHarness();

    harness.marquee.handleEntriesContainerMouseDown({
      button: 0,
      clientX: 20,
      clientY: 20,
      ctrlKey: false,
      metaKey: false,
      target: harness.entryElementA,
    } as unknown as MouseEvent);

    expect(harness.marquee.shouldSuppressEntryDrag.value).toBe(true);
  });
});
