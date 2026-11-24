/**
 * License policy data. MUST stay identical to spec/09-licensing-and-sbom.md §2 (D-014, D-016).
 * The spec is the source of truth; update both together.
 */

/** Licenses allowed for anything shipped in the app (SPDX ids). OFL-1.1 is for fonts only. */
export const ALLOWED_LICENSES = new Set([
  'MIT',
  'MIT-0',
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  '0BSD',
  'Zlib',
  'Apache-2.0',
  'BSL-1.0',
  'Unlicense',
  'CC0-1.0',
  'CC-BY-3.0',
  'CC-BY-4.0',
  'OFL-1.1',
]);

/** Runtime platform exceptions (D-016). Shipped unmodified with their own license notices. */
export const RUNTIME_EXCEPTIONS = [
  {
    package: 'electron',
    decision: 'D-016',
    url: 'https://www.electronjs.org/',
    description:
      'Electron application runtime, bundling Chromium and its third-party components (some under other licenses, e.g. LGPL FFmpeg). Shipped unmodified.',
    notices: ['LICENSE.electron.txt', 'LICENSES.chromium.html'],
  },
];
