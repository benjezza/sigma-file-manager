// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { getBuiltinLoadedIconTheme } from '@/modules/icon-theme/builtin-icon-themes';
import { resolveLoadedIconThemeIcon } from '@/modules/icon-theme/resolver';
import { BUILTIN_NAVIGATOR_ICON_THEME_IDS } from '@/types/icon-theme';

describe('builtin icon themes', () => {
  it('provides a Papirus theme definition', () => {
    const theme = getBuiltinLoadedIconTheme(BUILTIN_NAVIGATOR_ICON_THEME_IDS.papirus);

    expect(theme).not.toBeNull();
    expect(theme?.folder).toBe('folder');
    expect(theme?.file).toBe('file');
  });

  it('resolves mapped extension icons from the Papirus theme', () => {
    const theme = getBuiltinLoadedIconTheme(BUILTIN_NAVIGATOR_ICON_THEME_IDS.papirus);

    if (!theme) {
      throw new Error('Expected Papirus theme to be available');
    }

    const icon = resolveLoadedIconThemeIcon(theme, {
      name: 'index.ts',
      parentName: 'src',
      extension: 'ts',
      isDirectory: false,
    });

    expect(icon?.startsWith('data:image/svg+xml,') || icon?.includes('/assets/')).toBe(true);
  });
});
