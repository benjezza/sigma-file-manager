// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { ReadDirOptions } from '@/types/dir-entry';
import type {
  ListGroupBy,
  ListSortColumn,
  ListSortDirection,
  NavigatorLayoutType,
  NavigatorPathViewPreference,
  UserSettingsNavigator,
} from '@/types/user-settings';
import normalizePath from '@/utils/normalize-path';

export const FILE_BROWSER_SORT_COLUMNS: readonly ListSortColumn[] = [
  'name',
  'items',
  'size',
  'modified',
  'created',
  'tags',
  'kind',
  'links',
  'linkStatus',
];

export const FILE_BROWSER_SORT_COLUMN_LABEL_KEYS: Record<ListSortColumn, string> = {
  name: 'fileBrowser.name',
  items: 'fileBrowser.items',
  size: 'fileBrowser.size',
  modified: 'fileBrowser.modified',
  created: 'created',
  tags: 'fileBrowser.tags',
  kind: 'fileBrowser.kind',
  links: 'fileBrowser.links',
  linkStatus: 'fileBrowser.linkStatus',
};

export type FileBrowserListColumnLabelId = ListSortColumn | 'linkTarget';

export type NavigatorSortLayout = 'list' | 'grid' | 'compact-list' | undefined;

export type NavigatorSortSettingKeys = {
  column: 'navigator.listSortColumn' | 'navigator.gridSortColumn';
  direction: 'navigator.listSortDirection' | 'navigator.gridSortDirection';
};

export type NavigatorSortSettings = {
  column: ListSortColumn | null;
  direction: ListSortDirection;
};

export type NavigatorGroupBySettingKey = 'navigator.listGroupBy' | 'navigator.gridGroupBy';

export function isListSortColumn(value: string): value is ListSortColumn {
  return FILE_BROWSER_SORT_COLUMNS.includes(value as ListSortColumn);
}

function isNavigatorLayoutType(value: unknown): value is NavigatorLayoutType {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const maybeLayout = value as Record<string, unknown>;

  return (
    (maybeLayout.title === 'compactListLayout'
      || maybeLayout.title === 'listLayout'
      || maybeLayout.title === 'gridLayout')
    && (maybeLayout.name === 'compact-list'
      || maybeLayout.name === 'list'
      || maybeLayout.name === 'grid')
  );
}

function getNavigatorPathViewPreferences(
  navigator: UserSettingsNavigator,
): Record<string, NavigatorPathViewPreference> {
  const preferences = navigator.pathViewPreferences;

  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) {
    return {};
  }

  return preferences;
}

export function getNavigatorPathPreferenceKey(path: string | null | undefined): string | null {
  if (!path) {
    return null;
  }

  const normalizedPath = normalizePath(path).replace(/\/+$/, '');

  if (!normalizedPath) {
    return null;
  }

  const shouldFoldCase = /^[A-Za-z]:/.test(normalizedPath) || normalizedPath.startsWith('//');
  return shouldFoldCase ? normalizedPath.toLowerCase() : normalizedPath;
}

function getNavigatorPathViewPreference(
  navigator: UserSettingsNavigator,
  path: string | null | undefined,
): NavigatorPathViewPreference | null {
  const key = getNavigatorPathPreferenceKey(path);

  if (!key) {
    return null;
  }

  const preference = getNavigatorPathViewPreferences(navigator)[key];

  if (!preference || typeof preference !== 'object' || Array.isArray(preference)) {
    return null;
  }

  return preference;
}

function resolveSortDirection(value: unknown, fallback: ListSortDirection): ListSortDirection {
  return value === 'asc' || value === 'desc' ? value : fallback;
}

function resolveSortColumn(value: unknown, fallback: ListSortColumn | null): ListSortColumn | null {
  if (value === null) {
    return null;
  }

  if (typeof value === 'string' && isListSortColumn(value)) {
    return value;
  }

  return fallback;
}

function resolveGroupBy(value: unknown, fallback: ListGroupBy): ListGroupBy {
  if (value === 'none' || value === 'name' || value === 'modified' || value === 'kind') {
    return value;
  }

  return fallback;
}

export function isLinkMetadataSortColumn(column: ListSortColumn | null): boolean {
  return column === 'kind' || column === 'links' || column === 'linkStatus';
}

export function getFileBrowserListColumnLabelKey(columnId: FileBrowserListColumnLabelId): string {
  if (columnId === 'linkTarget') {
    return 'fileBrowser.linkTarget';
  }

  return FILE_BROWSER_SORT_COLUMN_LABEL_KEYS[columnId];
}

export function getFileBrowserListColumnLabel(
  translate: (key: string) => string,
  columnId: FileBrowserListColumnLabelId,
): string {
  return translate(getFileBrowserListColumnLabelKey(columnId));
}

export function getNavigatorSortSettingsForLayout(
  navigator: UserSettingsNavigator,
  layout: NavigatorSortLayout,
  path?: string | null,
): NavigatorSortSettings {
  const pathPreference = getNavigatorPathViewPreference(navigator, path);

  if (layout === 'grid') {
    return {
      column: resolveSortColumn(pathPreference?.gridSortColumn, navigator.gridSortColumn),
      direction: resolveSortDirection(pathPreference?.gridSortDirection, navigator.gridSortDirection),
    };
  }

  return {
    column: resolveSortColumn(pathPreference?.listSortColumn, navigator.listSortColumn),
    direction: resolveSortDirection(pathPreference?.listSortDirection, navigator.listSortDirection),
  };
}

export function getResolvedNavigatorSortColumn(
  navigator: UserSettingsNavigator,
  layout: NavigatorSortLayout,
  path?: string | null,
): ListSortColumn {
  return getNavigatorSortSettingsForLayout(navigator, layout, path).column ?? 'name';
}

export function getFileBrowserSortReadDirOptions(
  navigator: UserSettingsNavigator,
  layout: NavigatorSortLayout,
  path?: string | null,
): ReadDirOptions {
  const activeSortColumn = getNavigatorSortSettingsForLayout(navigator, layout, path).column;

  return {
    includeShortcutTargets: activeSortColumn === 'linkStatus',
    includeHardLinkCounts: isLinkMetadataSortColumn(activeSortColumn),
    includeItemCounts: activeSortColumn === 'items',
    includeHiddenItemCounts: navigator.showHiddenFiles,
  };
}

export function getNavigatorSortSettingKeys(layout: NavigatorSortLayout): NavigatorSortSettingKeys {
  if (layout === 'grid') {
    return {
      column: 'navigator.gridSortColumn',
      direction: 'navigator.gridSortDirection',
    };
  }

  return {
    column: 'navigator.listSortColumn',
    direction: 'navigator.listSortDirection',
  };
}

export function getNextNavigatorSortDirection(direction: ListSortDirection): ListSortDirection {
  return direction === 'asc' ? 'desc' : 'asc';
}

export function getNavigatorGroupByForLayout(
  navigator: UserSettingsNavigator,
  layout: NavigatorSortLayout,
  path?: string | null,
): ListGroupBy {
  const pathPreference = getNavigatorPathViewPreference(navigator, path);
  const fallbackListGroupBy = resolveGroupBy(navigator.listGroupBy, 'none');
  const fallbackGridGroupBy = resolveGroupBy(navigator.gridGroupBy, 'kind');

  if (layout === 'grid') {
    return resolveGroupBy(pathPreference?.gridGroupBy, fallbackGridGroupBy);
  }

  return resolveGroupBy(pathPreference?.listGroupBy, fallbackListGroupBy);
}

export function getNavigatorGroupBySettingKey(layout: NavigatorSortLayout): NavigatorGroupBySettingKey {
  return layout === 'grid' ? 'navigator.gridGroupBy' : 'navigator.listGroupBy';
}

export function getNavigatorSortColumnChangeUpdates(
  navigator: UserSettingsNavigator,
  layout: NavigatorSortLayout,
  column: ListSortColumn,
): Array<{
  key: NavigatorSortSettingKeys['column'] | NavigatorSortSettingKeys['direction'];
  value: ListSortColumn | ListSortDirection;
}> {
  const settingKeys = getNavigatorSortSettingKeys(layout);
  const currentColumn = getNavigatorSortSettingsForLayout(navigator, layout).column;
  const updates: Array<{
    key: NavigatorSortSettingKeys['column'] | NavigatorSortSettingKeys['direction'];
    value: ListSortColumn | ListSortDirection;
  }> = [{
    key: settingKeys.column,
    value: column,
  }];

  if (currentColumn !== column) {
    updates.push({
      key: settingKeys.direction,
      value: 'asc',
    });
  }

  return updates;
}

export function getNavigatorLayoutTypeForPath(
  navigator: UserSettingsNavigator,
  path?: string | null,
): NavigatorLayoutType {
  const pathPreference = getNavigatorPathViewPreference(navigator, path);
  const layoutType = pathPreference?.layoutType;

  return isNavigatorLayoutType(layoutType)
    ? layoutType
    : navigator.layout.type;
}

export function getNavigatorLayoutForPath(
  navigator: UserSettingsNavigator,
  path?: string | null,
): 'list' | 'grid' {
  const layoutName = getNavigatorLayoutTypeForPath(navigator, path).name;
  return layoutName === 'grid' ? 'grid' : 'list';
}

export function getUpdatedNavigatorPathViewPreferences(
  navigator: UserSettingsNavigator,
  path: string | null | undefined,
  patch: Partial<NavigatorPathViewPreference>,
): Record<string, NavigatorPathViewPreference> | null {
  const pathKey = getNavigatorPathPreferenceKey(path);

  if (!pathKey) {
    return null;
  }

  const pathViewPreferences = getNavigatorPathViewPreferences(navigator);

  return {
    ...pathViewPreferences,
    [pathKey]: {
      ...(getNavigatorPathViewPreference(navigator, pathKey) ?? {}),
      ...patch,
    },
  };
}
