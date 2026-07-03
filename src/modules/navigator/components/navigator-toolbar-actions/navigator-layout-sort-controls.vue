<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import type { ListGroupBy, ListSortColumn, ListSortDirection } from '@/types/user-settings';
import {
  getFileBrowserListColumnLabel,
  getNavigatorGroupByForLayout,
  getNavigatorGroupBySettingKey,
  getNavigatorSortColumnChangeUpdates,
  getNavigatorSortSettingsForLayout,
  getResolvedNavigatorSortColumn,
  isListSortColumn,
} from '@/modules/navigator/components/file-browser/utils/file-browser-sort-columns';

const props = defineProps<{
  sortLayout: 'list' | 'grid';
}>();

const { t } = useI18n();
const userSettingsStore = useUserSettingsStore();
const EXPLORER_SORT_COLUMNS: readonly ListSortColumn[] = [
  'name',
  'modified',
  'kind',
];
const GROUP_BY_OPTIONS: readonly ListGroupBy[] = [
  'none',
  'name',
  'modified',
  'kind',
];
const SORT_DIRECTIONS: readonly ListSortDirection[] = ['asc', 'desc'];

const sortSettings = computed(() => getNavigatorSortSettingsForLayout(
  userSettingsStore.userSettings.navigator,
  props.sortLayout,
));
const activeSortColumn = computed(() => getResolvedNavigatorSortColumn(
  userSettingsStore.userSettings.navigator,
  props.sortLayout,
));
const activeSortDirection = computed(() => sortSettings.value.direction);
const activeGroupBy = computed(() => getNavigatorGroupByForLayout(
  userSettingsStore.userSettings.navigator,
  props.sortLayout,
));

function handleSortColumnChange(value: unknown) {
  if (typeof value !== 'string' || !isListSortColumn(value) || !EXPLORER_SORT_COLUMNS.includes(value)) {
    return;
  }

  const updates = getNavigatorSortColumnChangeUpdates(
    userSettingsStore.userSettings.navigator,
    props.sortLayout,
    value,
  );

  for (const update of updates) {
    userSettingsStore.set(update.key, update.value);
  }
}

function handleSortDirectionChange(value: unknown) {
  if (value !== 'asc' && value !== 'desc') {
    return;
  }

  const directionKey = props.sortLayout === 'grid'
    ? 'navigator.gridSortDirection'
    : 'navigator.listSortDirection';
  userSettingsStore.set(directionKey, value);
}

function handleGroupByChange(value: unknown) {
  if (value !== 'none' && value !== 'name' && value !== 'modified' && value !== 'kind') {
    return;
  }

  userSettingsStore.set(getNavigatorGroupBySettingKey(props.sortLayout), value);
}

function getGroupByLabel(groupBy: ListGroupBy): string {
  if (groupBy === 'none') {
    return t('settings.navigator.none');
  }

  if (groupBy === 'name') {
    return t('fileBrowser.name');
  }

  if (groupBy === 'modified') {
    return t('fileBrowser.modified');
  }

  return t('fileBrowser.kind');
}
</script>

<template>
  <div class="navigator-layout-sort-controls">
    <div class="navigator-layout-sort-controls__group">
      <div class="navigator-layout-sort-controls__label">
        {{ t('settings.navigator.sortBy') }}
      </div>
      <Select
        :model-value="activeSortColumn"
        @update:model-value="handleSortColumnChange"
      >
        <SelectTrigger class="navigator-layout-sort-controls__select">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="column in EXPLORER_SORT_COLUMNS"
            :key="column"
            :value="column"
          >
            <SelectItemText>{{ getFileBrowserListColumnLabel(t, column) }}</SelectItemText>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div class="navigator-layout-sort-controls__group">
      <div class="navigator-layout-sort-controls__label">
        {{ t('settings.navigator.sortDirection') }}
      </div>
      <Select
        :model-value="activeSortDirection"
        @update:model-value="handleSortDirectionChange"
      >
        <SelectTrigger class="navigator-layout-sort-controls__select">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="direction in SORT_DIRECTIONS"
            :key="direction"
            :value="direction"
          >
            <SelectItemText>
              {{ direction === 'asc' ? t('settings.navigator.sortAscending') : t('settings.navigator.sortDescending') }}
            </SelectItemText>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div class="navigator-layout-sort-controls__group">
      <div class="navigator-layout-sort-controls__label">
        {{ t('settings.navigator.groupBy') }}
      </div>
      <Select
        :model-value="activeGroupBy"
        @update:model-value="handleGroupByChange"
      >
        <SelectTrigger class="navigator-layout-sort-controls__select">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="groupBy in GROUP_BY_OPTIONS"
            :key="groupBy"
            :value="groupBy"
          >
            <SelectItemText>{{ getGroupByLabel(groupBy) }}</SelectItemText>
          </SelectItem>
          <SelectSeparator />
          <SelectItem
            v-for="bucket in ['today', 'yesterday', 'earlierThisWeek', 'lastWeek', 'lastMonth', 'earlierThisYear']"
            :key="`bucket-${bucket}`"
            :value="`bucket:${bucket}`"
            disabled
          >
            <SelectItemText>{{ t(`settings.navigator.groupByModified.${bucket}`) }}</SelectItemText>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  </div>
</template>

<style>
.navigator-layout-sort-controls {
  display: flex;
  width: 100%;
  flex-direction: column;
  margin-top: 4px;
  gap: 8px;
}

.navigator-layout-sort-controls__group {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 4px;
}

.navigator-layout-sort-controls__label {
  color: hsl(var(--muted-foreground));
  font-size: 11px;
}

.navigator-layout-sort-controls__select.sigma-ui-select-trigger {
  height: 28px;
  font-size: 12px;
}
</style>
