// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { LoadedIconThemeDefinition } from '@/types/icon-theme';
import { BUILTIN_NAVIGATOR_ICON_THEME_IDS } from '@/types/icon-theme';

const papirusFolderIcon = new URL('../../assets/icons/papirus/places__folder.svg', import.meta.url).href;
const papirusFileIcon = new URL('../../assets/icons/papirus/mimetypes__text-x-generic.svg', import.meta.url).href;
const papirusImageIcon = new URL('../../assets/icons/papirus/mimetypes__image-x-generic.svg', import.meta.url).href;
const papirusVideoIcon = new URL('../../assets/icons/papirus/mimetypes__video-x-generic.svg', import.meta.url).href;
const papirusAudioIcon = new URL('../../assets/icons/papirus/mimetypes__audio-x-generic.svg', import.meta.url).href;
const papirusArchiveIcon = new URL('../../assets/icons/papirus/apps__ark.svg', import.meta.url).href;
const papirusCodeIcon = new URL('../../assets/icons/papirus/mimetypes__text-x-script.svg', import.meta.url).href;
const papirusPdfIcon = new URL('../../assets/icons/papirus/mimetypes__application-pdf.svg', import.meta.url).href;
const papirusExecutableIcon = new URL('../../assets/icons/papirus/apps__application-default-icon.svg', import.meta.url).href;
const papirusFontIcon = new URL('../../assets/icons/papirus/mimetypes__application-x-font-ttf.svg', import.meta.url).href;

const PAPIRUS_THEME: LoadedIconThemeDefinition = {
  iconDefinitions: {
    folder: { src: papirusFolderIcon },
    file: { src: papirusFileIcon },
    image: { src: papirusImageIcon },
    video: { src: papirusVideoIcon },
    audio: { src: papirusAudioIcon },
    archive: { src: papirusArchiveIcon },
    code: { src: papirusCodeIcon },
    pdf: { src: papirusPdfIcon },
    executable: { src: papirusExecutableIcon },
    font: { src: papirusFontIcon },
  },
  file: 'file',
  folder: 'folder',
  fileExtensions: {
    // Text / docs
    'txt': 'file',
    'md': 'file',
    'log': 'file',
    'csv': 'file',
    'rtf': 'file',
    // Images
    'jpg': 'image',
    'jpeg': 'image',
    'png': 'image',
    'gif': 'image',
    'webp': 'image',
    'bmp': 'image',
    'svg': 'image',
    'ico': 'image',
    'heic': 'image',
    // Video
    'mp4': 'video',
    'mkv': 'video',
    'avi': 'video',
    'mov': 'video',
    'webm': 'video',
    // Audio
    'mp3': 'audio',
    'wav': 'audio',
    'flac': 'audio',
    'ogg': 'audio',
    'm4a': 'audio',
    'aac': 'audio',
    // Archives
    'zip': 'archive',
    'rar': 'archive',
    '7z': 'archive',
    'tar': 'archive',
    'gz': 'archive',
    'bz2': 'archive',
    'xz': 'archive',
    // Code
    'js': 'code',
    'jsx': 'code',
    'ts': 'code',
    'tsx': 'code',
    'json': 'code',
    'css': 'code',
    'html': 'code',
    'xml': 'code',
    'yml': 'code',
    'yaml': 'code',
    'vue': 'code',
    'py': 'code',
    'rs': 'code',
    'go': 'code',
    'java': 'code',
    'c': 'code',
    'h': 'code',
    'cpp': 'code',
    'hpp': 'code',
    'sh': 'code',
    'ps1': 'code',
    'bat': 'code',
    'cmd': 'code',
    // Special
    'pdf': 'pdf',
    'exe': 'executable',
    'msi': 'executable',
    'com': 'executable',
    'dll': 'executable',
    'so': 'executable',
    'ttf': 'font',
    'otf': 'font',
    'woff': 'font',
    'woff2': 'font',
  },
};

export function getBuiltinLoadedIconTheme(iconThemeId: string): LoadedIconThemeDefinition | null {
  if (iconThemeId === BUILTIN_NAVIGATOR_ICON_THEME_IDS.papirus) {
    return PAPIRUS_THEME;
  }

  return null;
}
