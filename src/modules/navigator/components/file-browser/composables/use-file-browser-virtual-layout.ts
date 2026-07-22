// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  watch,
  type ComponentPublicInstance,
  type ComputedRef,
} from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import type { ListGroupBy, ListSortDirection } from '@/types/user-settings';
import normalizePath from '@/utils/normalize-path';
import { computeVerticalVirtualRange } from '@/composables/use-vertical-virtual-list';
import { groupFileBrowserEntries } from '../file-browser-entry-groups';
import { getFileBrowserGridGap } from '../utils/file-browser-layout-gaps';
import { getElementContentBoxWidth } from '../utils/file-browser-content-box';
import { i18n } from '@/localization';
import {
  getGridColumnCount,
  type FileBrowserGridEntryVariant,
  type FileBrowserGridItemsVirtualRow,
  type FileBrowserGridSectionVirtualRow,
  type FileBrowserListGroupVirtualRow,
  type FileBrowserListVirtualRow,
  type FileBrowserVirtualRow,
} from '../utils/file-browser-virtual-rows';

export type {
  FileBrowserGridEntryVariant,
  FileBrowserGridItemsVirtualRow,
  FileBrowserGridSectionVirtualRow,
  FileBrowserListGroupVirtualRow,
  FileBrowserListVirtualRow,
  FileBrowserVirtualRow,
} from '../utils/file-browser-virtual-rows';
export { getGridColumnCount } from '../utils/file-browser-virtual-rows';

const LIST_ENTRY_HEIGHT = 42;
const LIST_ENTRY_WITH_DESCRIPTION_HEIGHT = 56;
const LIST_GROUP_HEADER_HEIGHT = 34;
const GRID_SECTION_HEADER_HEIGHT = 42;
const GRID_DIR_ENTRY_HEIGHT = 52;
const GRID_ENTRY_HEIGHT = 120;
const VIRTUAL_OVERSCAN_PX = 420;
const SCROLL_TO_PATH_DOM_SYNC_ATTEMPTS = 12;
const STATUS_BAR_BORDER_CLEARANCE = 2;
const SCROLL_VIEWPORT_SELECTOR = '.file-browser__scroll-area-viewport';
const ENTRIES_CONTAINER_SELECTOR = '.file-browser__entries-container';
const CONTENT_INNER_SELECTOR = '.file-browser__content-inner';
const FILE_BROWSER_SELECTOR = '.file-browser';
const STATUS_BAR_SELECTOR = '.file-browser-status-bar';
const VIRTUAL_SPACER_SELECTOR = '.file-browser-list-view__list, .file-browser-grid-view__spacer';

interface GridSectionDefinition {
  id: string;
  label: string;
  variant: FileBrowserGridEntryVariant;
  entries: DirEntry[];
  stickyIndex: number;
  entryHeight: number;
}

type EntryGroup = {
  id: string;
  label: string;
  variant: FileBrowserGridEntryVariant;
  entries: DirEntry[];
};

type ModifiedGroupBucketKey = 'today' | 'yesterday' | 'earlierThisWeek' | 'lastWeek' | 'lastMonth' | 'earlierThisYear' | 'older';

const DATE_GROUP_ORDER: readonly ModifiedGroupBucketKey[] = [
  'today',
  'yesterday',
  'earlierThisWeek',
  'lastWeek',
  'lastMonth',
  'earlierThisYear',
  'older',
];

const NAME_COLLATOR = new Intl.Collator(undefined, {
  sensitivity: 'base',
  numeric: true,
});

function getGridEntryVariant(entry: DirEntry): FileBrowserGridEntryVariant {
  if (entry.is_dir) {
    return 'dir';
  }

  if (entry.mime?.startsWith('image/')) {
    return 'image';
  }

  if (entry.mime?.startsWith('video/')) {
    return 'video';
  }

  return 'other';
}

function getModifiedGroupBucket(timestamp: number, nowMs: number): ModifiedGroupBucketKey {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return 'older';
  }

  const now = new Date(nowMs);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  if (timestamp >= todayStart) {
    return 'today';
  }

  const yesterdayStart = todayStart - (24 * 60 * 60 * 1000);

  if (timestamp >= yesterdayStart) {
    return 'yesterday';
  }

  const thisWeekStart = new Date(now);
  const weekday = (thisWeekStart.getDay() + 6) % 7;
  thisWeekStart.setHours(0, 0, 0, 0);
  thisWeekStart.setDate(thisWeekStart.getDate() - weekday);
  const thisWeekStartMs = thisWeekStart.getTime();

  if (timestamp >= thisWeekStartMs) {
    return 'earlierThisWeek';
  }

  const lastWeekStartMs = thisWeekStartMs - (7 * 24 * 60 * 60 * 1000);

  if (timestamp >= lastWeekStartMs) {
    return 'lastWeek';
  }

  const thisMonthStartMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  if (timestamp >= thisMonthStartMs) {
    return 'lastMonth';
  }

  const thisYearStartMs = new Date(now.getFullYear(), 0, 1).getTime();

  if (timestamp >= thisYearStartMs) {
    return 'earlierThisYear';
  }

  return 'older';
}

function getModifiedGroupLabel(bucket: ModifiedGroupBucketKey): string {
  switch (bucket) {
    case 'today':
      return 'Today';
    case 'yesterday':
      return 'Yesterday';
    case 'earlierThisWeek':
      return 'Earlier this week';
    case 'lastWeek':
      return 'Last week';
    case 'lastMonth':
      return 'Last month';
    case 'earlierThisYear':
      return 'Earlier this year';
    default:
      return 'Older';
  }
}

function translate(key: string): string {
  return i18n.global.t(key);
}

function resolveScrollViewportElement(element: HTMLElement): HTMLElement {
  if (element.matches(SCROLL_VIEWPORT_SELECTOR)) {
    return element;
  }

  const closestViewport = element.closest<HTMLElement>(SCROLL_VIEWPORT_SELECTOR);

  if (closestViewport) {
    return closestViewport;
  }

  return element.querySelector<HTMLElement>(SCROLL_VIEWPORT_SELECTOR) ?? element;
}

function resolveElement(element: Element | ComponentPublicInstance | null): HTMLElement | null {
  const rawElement = element instanceof HTMLElement
    ? element
    : element && '$el' in element && element.$el instanceof HTMLElement
      ? element.$el
      : null;

  return rawElement ? resolveScrollViewportElement(rawElement) : null;
}

function getRowEnd(row: FileBrowserVirtualRow): number {
  return row.start + row.size;
}

function getRowScrollMarginTop(
  row: FileBrowserVirtualRow,
  virtualContentOffset: number,
  gridGap: number,
): number {
  if (row.type === 'list-entry' || row.type === 'list-group') {
    return virtualContentOffset;
  }

  return row.type === 'grid-items' ? GRID_SECTION_HEADER_HEIGHT + gridGap : 0;
}

function getStatusBarOverlap(viewport: HTMLElement, statusBar: HTMLElement | null | undefined): number {
  if (!statusBar) {
    return 0;
  }

  const viewportRect = viewport.getBoundingClientRect();
  const statusBarRect = statusBar.getBoundingClientRect();
  const overlap = Math.max(0, viewportRect.bottom - statusBarRect.top);

  return overlap > 0 ? overlap + STATUS_BAR_BORDER_CLEARANCE : 0;
}

function getVirtualContentOffset(viewport: HTMLElement): number {
  const virtualSpacer = viewport.querySelector<HTMLElement>(VIRTUAL_SPACER_SELECTOR);

  if (!virtualSpacer) {
    return 0;
  }

  return Math.max(0, virtualSpacer.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop);
}

function escapeCssAttribute(value: string): string {
  return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(value) : value.replace(/"/g, '\\"');
}

function getEntryDescriptionHeight(
  entry: DirEntry,
  entryDescription?: (entry: DirEntry) => string | undefined,
): number {
  return entryDescription?.(entry) ? LIST_ENTRY_WITH_DESCRIPTION_HEIGHT : LIST_ENTRY_HEIGHT;
}

export function resolveViewportContentWidth(viewport: HTMLElement): number {
  const entriesContainer = viewport.querySelector<HTMLElement>(ENTRIES_CONTAINER_SELECTOR);

  if (entriesContainer) {
    return getElementContentBoxWidth(entriesContainer);
  }

  const contentInner = viewport.querySelector<HTMLElement>(CONTENT_INNER_SELECTOR);

  if (contentInner) {
    return getElementContentBoxWidth(contentInner);
  }

  return getElementContentBoxWidth(viewport);
}

function buildGroups(
  entries: readonly DirEntry[],
  groupBy: ListGroupBy,
  sortDirection: ListSortDirection,
): EntryGroup[] {
  if (groupBy === 'kind') {
    const grouped = groupFileBrowserEntries(entries);
    const kindGroups: EntryGroup[] = [
      {
        id: 'kind:folders',
        label: translate('fileBrowser.folders'),
        variant: 'dir',
        entries: grouped.dirs,
      },
      {
        id: 'kind:images',
        label: translate('fileBrowser.images'),
        variant: 'image',
        entries: grouped.images,
      },
      {
        id: 'kind:videos',
        label: translate('fileBrowser.videos'),
        variant: 'video',
        entries: grouped.videos,
      },
      {
        id: 'kind:otherFiles',
        label: translate('fileBrowser.otherFiles'),
        variant: 'other',
        entries: grouped.others,
      },
    ];

    return kindGroups.filter(group => group.entries.length > 0);
  }

  if (groupBy === 'name') {
    const groupsById = new Map<string, EntryGroup>();

    for (const entry of entries) {
      const normalizedName = entry.name.trim();
      const firstCharacter = normalizedName.length > 0 ? normalizedName[0].toUpperCase() : '#';
      const groupLabel = /^[A-Z0-9]$/.test(firstCharacter) ? firstCharacter : '#';
      const groupId = `name:${groupLabel}`;
      const groupVariant = getGridEntryVariant(entry);
      const existingGroup = groupsById.get(groupId);

      if (existingGroup) {
        existingGroup.entries.push(entry);
        if (existingGroup.variant !== 'dir' && groupVariant === 'dir') {
          existingGroup.variant = 'dir';
        }
        continue;
      }

      groupsById.set(groupId, {
        id: groupId,
        label: groupLabel,
        variant: groupVariant === 'dir' ? 'dir' : 'other',
        entries: [entry],
      });
    }

    const sortedGroups = [...groupsById.values()].sort((left, right) => NAME_COLLATOR.compare(left.label, right.label));
    return sortDirection === 'desc' ? sortedGroups.reverse() : sortedGroups;
  }

  if (groupBy === 'modified') {
    const groupsByBucket = new Map<ModifiedGroupBucketKey, EntryGroup>();
    const nowMs = Date.now();

    for (const entry of entries) {
      const bucket = getModifiedGroupBucket(entry.modified_time, nowMs);
      const groupVariant = getGridEntryVariant(entry);
      const existingGroup = groupsByBucket.get(bucket);

      if (existingGroup) {
        existingGroup.entries.push(entry);
        if (existingGroup.variant !== 'dir' && groupVariant === 'dir') {
          existingGroup.variant = 'dir';
        }
        continue;
      }

      groupsByBucket.set(bucket, {
        id: `modified:${bucket}`,
        label: getModifiedGroupLabel(bucket),
        variant: groupVariant === 'dir' ? 'dir' : 'other',
        entries: [entry],
      });
    }

    return DATE_GROUP_ORDER
      .map(bucket => groupsByBucket.get(bucket))
      .filter((group): group is EntryGroup => !!group && group.entries.length > 0);
  }

  return [];
}

function createListRows(
  entries: readonly DirEntry[],
  groupBy: ListGroupBy,
  sortDirection: ListSortDirection,
  entryDescription?: (entry: DirEntry) => string | undefined,
): FileBrowserVirtualRow[] {
  let offset = 0;
  const rows: FileBrowserVirtualRow[] = [];
  const groups = groupBy === 'none'
    ? []
    : buildGroups(entries, groupBy, sortDirection);

  if (groups.length === 0) {
    return entries.map((entry, entryIndex) => {
      const size = getEntryDescriptionHeight(entry, entryDescription);
      const row: FileBrowserListVirtualRow = {
        type: 'list-entry',
        key: `list:${entry.path}`,
        entry,
        entryIndex,
        start: offset,
        size,
      };

      offset += size;
      return row;
    });
  }

  let entryIndex = 0;

  for (const group of groups) {
    const groupRow: FileBrowserListGroupVirtualRow = {
      type: 'list-group',
      key: `list-group:${group.id}`,
      groupId: group.id,
      groupLabel: group.label,
      count: group.entries.length,
      start: offset,
      size: LIST_GROUP_HEADER_HEIGHT,
    };
    rows.push(groupRow);
    offset += LIST_GROUP_HEADER_HEIGHT;

    for (const entry of group.entries) {
      const size = getEntryDescriptionHeight(entry, entryDescription);
      rows.push({
        type: 'list-entry',
        key: `list:${entry.path}`,
        entry,
        entryIndex,
        start: offset,
        size,
      });
      offset += size;
      entryIndex += 1;
    }
  }

  return rows;
}

function createGridSectionRows(
  section: GridSectionDefinition,
  columnCount: number,
  offset: number,
  gridGap: number,
): {
  rows: FileBrowserVirtualRow[];
  offset: number;
} {
  if (section.entries.length === 0) {
    return {
      rows: [],
      offset,
    };
  }

  const rows: FileBrowserVirtualRow[] = [
    {
      type: 'grid-section',
      key: `grid-section:${section.id}`,
      sectionId: section.id,
      sectionKey: section.id,
      label: section.label,
      variant: section.variant,
      count: section.entries.length,
      stickyIndex: section.stickyIndex,
      start: offset,
      size: GRID_SECTION_HEADER_HEIGHT + gridGap,
    },
  ];

  offset += GRID_SECTION_HEADER_HEIGHT + gridGap;

  for (let entryIndex = 0, rowIndex = 0; entryIndex < section.entries.length; entryIndex += columnCount, rowIndex += 1) {
    const rowEntries = section.entries.slice(entryIndex, entryIndex + columnCount);

    rows.push({
      type: 'grid-items',
      key: `grid-items:${section.id}:${rowIndex}:${rowEntries.map(entry => entry.path).join('|')}`,
      sectionId: section.id,
      sectionKey: section.id,
      variant: section.variant,
      entries: rowEntries,
      rowIndex,
      start: offset,
      size: section.entryHeight + gridGap,
    });

    offset += section.entryHeight + gridGap;
  }

  return {
    rows,
    offset,
  };
}

function createGridRows(
  entries: readonly DirEntry[],
  groupBy: ListGroupBy,
  sortDirection: ListSortDirection,
  columnCount: number,
  gridGap: number,
): FileBrowserVirtualRow[] {
  const defaultGroups: EntryGroup[] = (() => {
    const groupedEntries = groupFileBrowserEntries(entries);

    return [
      {
        id: 'kind:folders',
        label: translate('fileBrowser.folders'),
        variant: 'dir',
        entries: groupedEntries.dirs,
      },
      {
        id: 'kind:images',
        label: translate('fileBrowser.images'),
        variant: 'image',
        entries: groupedEntries.images,
      },
      {
        id: 'kind:videos',
        label: translate('fileBrowser.videos'),
        variant: 'video',
        entries: groupedEntries.videos,
      },
      {
        id: 'kind:otherFiles',
        label: translate('fileBrowser.otherFiles'),
        variant: 'other',
        entries: groupedEntries.others,
      },
    ];
  })();

  const groups = groupBy === 'none' ? defaultGroups : buildGroups(entries, groupBy, sortDirection);
  const sections: GridSectionDefinition[] = groups.map((group, index) => ({
    id: group.id,
    label: group.label,
    variant: group.variant,
    entries: group.entries,
    stickyIndex: 10 + index,
    entryHeight: group.variant === 'dir' ? GRID_DIR_ENTRY_HEIGHT : GRID_ENTRY_HEIGHT,
  }));

  let offset = 0;
  const rows: FileBrowserVirtualRow[] = [];

  for (const section of sections) {
    const result = createGridSectionRows(section, columnCount, offset, gridGap);
    rows.push(...result.rows);
    offset = result.offset;
  }

  return rows;
}

export function createFileBrowserVirtualRows(options: {
  entries: readonly DirEntry[];
  layout: 'list' | 'grid' | undefined;
  groupBy?: ListGroupBy;
  sortDirection?: ListSortDirection;
  viewportWidth: number;
  entryDescription?: (entry: DirEntry) => string | undefined;
  increaseFileViewGaps?: boolean;
}): FileBrowserVirtualRow[] {
  const groupBy = options.groupBy ?? 'none';
  const sortDirection = options.sortDirection ?? 'asc';

  if (options.layout === 'grid') {
    const gridGap = getFileBrowserGridGap(!!options.increaseFileViewGaps);
    return createGridRows(
      options.entries,
      groupBy,
      sortDirection,
      getGridColumnCount(options.viewportWidth, gridGap),
      gridGap,
    );
  }

  return createListRows(
    options.entries,
    groupBy,
    sortDirection,
    options.entryDescription,
  );
}

export function getFileBrowserGridNavigationEntry(
  rows: readonly FileBrowserVirtualRow[],
  path: string,
  direction: 'up' | 'down',
): DirEntry | null {
  const currentRow = rows.find((row): row is FileBrowserGridItemsVirtualRow => {
    return row.type === 'grid-items' && row.entries.some(entry => entry.path === path);
  });

  if (!currentRow) {
    return null;
  }

  const currentColumnIndex = currentRow.entries.findIndex(entry => entry.path === path);
  const gridRows = rows.filter((row): row is FileBrowserGridItemsVirtualRow => row.type === 'grid-items');
  const currentGridRowIndex = gridRows.findIndex(row => row === currentRow);
  const targetGridRowIndex = direction === 'down' ? currentGridRowIndex + 1 : currentGridRowIndex - 1;
  const targetRow = gridRows[targetGridRowIndex];

  if (!targetRow) {
    return null;
  }

  return targetRow.entries[Math.min(currentColumnIndex, targetRow.entries.length - 1)] ?? null;
}

export function useFileBrowserVirtualLayout(options: {
  entries: ComputedRef<DirEntry[]>;
  layout: () => 'list' | 'grid' | undefined;
  groupBy?: () => ListGroupBy;
  sortDirection?: () => ListSortDirection;
  entryDescription?: (entry: DirEntry) => string | undefined;
  increaseFileViewGaps?: () => boolean;
}) {
  const scrollViewportRef = ref<HTMLElement | null>(null);
  const viewportHeight = ref(0);
  const viewportWidth = ref(0);
  const bottomScrollMargin = ref(0);
  const scrollTop = ref(0);
  const virtualContentOffset = ref(0);
  let viewportResizeObserver: ResizeObserver | null = null;

  const gridGap = computed(() => getFileBrowserGridGap(!!options.increaseFileViewGaps?.()));
  const gridColumnCount = computed(() => getGridColumnCount(viewportWidth.value, gridGap.value));

  const rows = computed<FileBrowserVirtualRow[]>(() => {
    return createFileBrowserVirtualRows({
      entries: options.entries.value,
      layout: options.layout(),
      groupBy: options.groupBy?.() ?? 'none',
      sortDirection: options.sortDirection?.() ?? 'asc',
      viewportWidth: viewportWidth.value,
      entryDescription: options.entryDescription,
      increaseFileViewGaps: options.increaseFileViewGaps?.(),
    });
  });

  const totalSize = computed(() => {
    const lastRow = rows.value[rows.value.length - 1];
    return (lastRow ? getRowEnd(lastRow) : 0) + bottomScrollMargin.value;
  });

  const visibleRows = computed(() => {
    const virtualScrollTop = Math.max(0, scrollTop.value - virtualContentOffset.value);
    const rowItems = rows.value;
    const visibleRange = computeVerticalVirtualRange({
      items: rowItems,
      overscanPx: VIRTUAL_OVERSCAN_PX,
      scrollTop: virtualScrollTop,
      viewportHeight: viewportHeight.value,
    });

    return rowItems.slice(visibleRange.start, visibleRange.end);
  });

  const activeGridSectionRow = computed(() => {
    if (options.layout() !== 'grid') {
      return null;
    }

    let activeRow: FileBrowserGridSectionVirtualRow | null = null;
    const virtualScrollTop = Math.max(0, scrollTop.value - virtualContentOffset.value);

    for (const row of rows.value) {
      if (row.start > virtualScrollTop) {
        break;
      }

      if (row.type === 'grid-section') {
        activeRow = row;
      }
    }

    return activeRow;
  });

  const offsetY = computed(() => visibleRows.value[0]?.start ?? 0);

  const spacerStyle = computed(() => ({
    height: `${totalSize.value}px`,
  }));

  const windowStyle = computed(() => ({
    transform: `translate3d(0, ${offsetY.value}px, 0)`,
  }));

  function updateViewportSize() {
    const viewport = scrollViewportRef.value;

    if (!viewport) {
      viewportHeight.value = 0;
      viewportWidth.value = 0;
      virtualContentOffset.value = 0;
      scrollTop.value = 0;
      return;
    }

    const fileBrowser = viewport.closest<HTMLElement>(FILE_BROWSER_SELECTOR);
    const statusBar = fileBrowser?.querySelector<HTMLElement>(STATUS_BAR_SELECTOR);

    viewportHeight.value = viewport.clientHeight;
    viewportWidth.value = resolveViewportContentWidth(viewport);
    virtualContentOffset.value = getVirtualContentOffset(viewport);
    bottomScrollMargin.value = getStatusBarOverlap(viewport, statusBar);
    scrollTop.value = Math.max(0, viewport.scrollTop);
  }

  function disconnectViewportResizeObserver() {
    viewportResizeObserver?.disconnect();
    viewportResizeObserver = null;
  }

  function observeViewportSize() {
    disconnectViewportResizeObserver();

    const viewport = scrollViewportRef.value;

    if (!viewport || typeof ResizeObserver === 'undefined') {
      updateViewportSize();
      return;
    }

    viewportResizeObserver = new ResizeObserver(updateViewportSize);
    viewportResizeObserver.observe(viewport);

    const contentInner = viewport.querySelector<HTMLElement>(CONTENT_INNER_SELECTOR);

    if (contentInner) {
      viewportResizeObserver.observe(contentInner);
    }

    updateViewportSize();
  }

  function scheduleViewportSizeUpdate() {
    nextTick(() => {
      updateViewportSize();
      requestAnimationFrame(updateViewportSize);
    });
  }

  function setScrollViewportRef(element: Element | ComponentPublicInstance | null) {
    const viewport = resolveElement(element);

    if (scrollViewportRef.value === viewport) {
      return;
    }

    scrollViewportRef.value = viewport;
    observeViewportSize();
  }

  function handleScroll(event: Event) {
    const target = event.currentTarget;

    if (target instanceof HTMLElement) {
      const viewport = resolveScrollViewportElement(target);

      if (scrollViewportRef.value !== viewport) {
        scrollViewportRef.value = viewport;
        observeViewportSize();
      }

      scrollTop.value = Math.max(0, viewport.scrollTop);
    }
  }

  function entryPathsMatch(left: string, right: string): boolean {
    return normalizePath(left) === normalizePath(right);
  }

  function getEntryElement(path: string): HTMLElement | null {
    const viewport = scrollViewportRef.value;

    if (!viewport) {
      return null;
    }

    const normalizedPath = normalizePath(path);
    const candidates = path === normalizedPath ? [path] : [normalizedPath, path];

    for (const candidate of [...new Set(candidates)]) {
      const match = viewport.querySelector<HTMLElement>(
        `[data-entry-path="${escapeCssAttribute(candidate)}"]`,
      );

      if (match) {
        return match;
      }
    }

    return null;
  }

  async function ensureEntryElementInView(
    path: string,
    row: FileBrowserVirtualRow,
    align: ScrollLogicalPosition,
  ) {
    await nextTick();

    const viewport = scrollViewportRef.value;
    const entryElement = getEntryElement(path);

    if (!viewport || !entryElement) {
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const entryRect = entryElement.getBoundingClientRect();
    const minVisibleTop = viewportRect.top + getRowScrollMarginTop(row, virtualContentOffset.value, gridGap.value);
    const maxVisibleBottom = viewportRect.bottom - bottomScrollMargin.value;
    let scrollAdjustment = 0;

    if (align === 'center') {
      const viewportCenter = minVisibleTop + (maxVisibleBottom - minVisibleTop) / 2;
      const entryCenter = entryRect.top + entryRect.height / 2;
      scrollAdjustment = entryCenter - viewportCenter;
    }
    else if (align === 'start') {
      scrollAdjustment = entryRect.top - minVisibleTop;
    }
    else if (align === 'end') {
      scrollAdjustment = entryRect.bottom - maxVisibleBottom;
    }
    else if (entryRect.top < minVisibleTop) {
      scrollAdjustment = entryRect.top - minVisibleTop;
    }
    else if (entryRect.bottom > maxVisibleBottom) {
      scrollAdjustment = entryRect.bottom - maxVisibleBottom;
    }

    if (scrollAdjustment !== 0) {
      setScrollTop(scrollTop.value + scrollAdjustment);
      await nextTick();
    }
  }

  function findRowByPath(path: string): FileBrowserVirtualRow | null {
    return rows.value.find((row) => {
      if (row.type === 'list-entry') {
        return entryPathsMatch(row.entry.path, path);
      }

      if (row.type === 'grid-items') {
        return row.entries.some(entry => entryPathsMatch(entry.path, path));
      }

      return false;
    }) ?? null;
  }

  function getMaxScrollTop() {
    const viewport = scrollViewportRef.value;
    const virtualMaxScrollTop = Math.max(0, virtualContentOffset.value + totalSize.value - viewportHeight.value);
    const browserMaxScrollTop = viewport ? Math.max(0, viewport.scrollHeight - viewport.clientHeight) : 0;

    return Math.max(virtualMaxScrollTop, browserMaxScrollTop);
  }

  function setScrollTop(nextScrollTop: number) {
    const viewport = scrollViewportRef.value;

    if (!viewport) {
      return;
    }

    const maxScrollTop = getMaxScrollTop();
    const normalizedScrollTop = Math.min(Math.max(0, nextScrollTop), maxScrollTop);
    viewport.scrollTop = normalizedScrollTop;
    scrollTop.value = normalizedScrollTop;
  }

  async function scrollToRow(row: FileBrowserVirtualRow, align: ScrollLogicalPosition = 'nearest') {
    const currentViewportHeight = viewportHeight.value;
    const currentScrollTop = scrollTop.value;
    const rowStart = virtualContentOffset.value + row.start;
    const rowEnd = virtualContentOffset.value + getRowEnd(row);
    const scrollMarginTop = getRowScrollMarginTop(row, virtualContentOffset.value, gridGap.value);
    const scrollMarginBottom = bottomScrollMargin.value;

    if (align === 'center') {
      setScrollTop(rowStart - (currentViewportHeight - row.size) / 2);
    }
    else if (align === 'end') {
      setScrollTop(rowEnd - currentViewportHeight + scrollMarginBottom);
    }
    else if (align === 'start') {
      setScrollTop(rowStart - scrollMarginTop);
    }
    else if (rowStart < currentScrollTop + scrollMarginTop) {
      setScrollTop(rowStart - scrollMarginTop);
    }
    else if (rowEnd > currentScrollTop + currentViewportHeight - scrollMarginBottom) {
      setScrollTop(rowEnd - currentViewportHeight + scrollMarginBottom);
    }

    await nextTick();
  }

  async function scrollToPath(path: string, align: ScrollLogicalPosition = 'nearest'): Promise<boolean> {
    const row = findRowByPath(path);

    if (!row) {
      return false;
    }

    for (let attemptIndex = 0; attemptIndex < SCROLL_TO_PATH_DOM_SYNC_ATTEMPTS; attemptIndex += 1) {
      await scrollToRow(row, align);
      await nextTick();
      await new Promise<void>((resolveFrame) => {
        requestAnimationFrame(() => resolveFrame());
      });

      const entryElement = getEntryElement(path);

      if (entryElement) {
        await ensureEntryElementInView(path, row, align);
        return true;
      }
    }

    return false;
  }

  async function scrollToIndex(index: number, align: ScrollLogicalPosition = 'nearest'): Promise<boolean> {
    const entry = options.entries.value[index];

    if (!entry) {
      return false;
    }

    return scrollToPath(entry.path, align);
  }

  function getGridNavigationEntry(path: string, direction: 'up' | 'down'): DirEntry | null {
    return getFileBrowserGridNavigationEntry(rows.value, path, direction);
  }

  watch(rows, () => {
    const viewport = scrollViewportRef.value;

    if (!viewport) {
      return;
    }

    if (scrollTop.value > getMaxScrollTop()) {
      setScrollTop(getMaxScrollTop());
    }
  });

  watch(options.entries, () => {
    scheduleViewportSizeUpdate();
  });

  watch(() => options.layout(), () => {
    scheduleViewportSizeUpdate();
  });

  watch(() => options.increaseFileViewGaps?.(), () => {
    scheduleViewportSizeUpdate();
  });

  onBeforeUnmount(() => {
    disconnectViewportResizeObserver();
  });

  return {
    scrollViewportRef,
    viewportHeight,
    viewportWidth,
    scrollTop,
    virtualContentOffset,
    gridColumnCount,
    gridGap,
    rows,
    visibleRows,
    activeGridSectionRow,
    totalSize,
    offsetY,
    spacerStyle,
    windowStyle,
    setScrollViewportRef,
    setScrollTop,
    scheduleViewportSizeUpdate,
    handleScroll,
    getEntryElement,
    scrollToPath,
    scrollToIndex,
    getGridNavigationEntry,
  };
}
