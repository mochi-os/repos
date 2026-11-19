// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { path, Refusal } from '@mochi/web'

// Encode a ref or path for a URL segment while keeping its slashes. The tree
// and blob routes take a splat, so "/" separates segments and has to survive,
// but a "#", "?" or "%" in a branch or file name truncates the request. Git
// allows no empty, "." or ".." component in a ref or a path, and the URL
// resolves those away, so a link naming one would climb out of the route to
// another action of the repository: it is refused, not sent. A slash at
// either end is dropped first: an address typed for a folder ends in one.
export const encodeRef = (value: string) =>
  value
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .map((part) => {
      if (part === '' || part === '.' || part === '..') {
        // eslint-disable-next-line lingui/no-unlocalized-strings -- for developers; normalizeError shows the caller's words
        throw new Refusal(`Not a ref or path: ${value}`) // path-ok: an error message, not a path
      }
      return encodeURIComponent(part)
    })
    .join('/')

const endpoints = {
  // Repository operations
  repo: {
    // Class-level endpoints (no entity context)
    info: '-/info',
    create: '-/create',
    search: '-/search',
    recommendations: '-/recommendations',
    probe: '-/probe',
    share: (repoId: string) => path`${repoId}/-/share`,
    subscribe: '-/subscribe',
    unsubscribe: '-/unsubscribe',

    // Entity-level endpoints (caller should set baseURL to /{repoId}/-/)
    settingsSet: 'settings/set',
    rename: 'rename',
    delete: 'delete',
    // Access control
    access: 'access',
    accessSet: 'access/set',
    accessRevoke: 'access/revoke',
    // Git operations
    branches: 'branches',
    branchCreate: 'branches/create',
    branchDelete: 'branches/delete',
    tags: 'tags',
    // A ref or a file path is a splat, so encodeRef keeps its slashes and
    // encodes each segment between them, as path does a single one.
    commits: (ref?: string) => (ref ? `commits/${encodeRef(ref)}` : 'commits'), // path-ok: encodeRef encodes each segment
    commit: (sha: string) => path`commit/${sha}`,
    // No ref is the repository's default branch, as its info names it.
    tree: (ref: string, file?: string) =>
      !ref
        ? 'tree'
        : file
          ? `tree/${encodeRef(ref)}/${encodeRef(file)}` // path-ok: encodeRef encodes each segment
          : `tree/${encodeRef(ref)}`, // path-ok: encodeRef encodes each segment
    blob: (ref: string, file: string) =>
      `blob/${encodeRef(ref)}/${encodeRef(file)}`, // path-ok: encodeRef encodes each segment
    diff: 'diff',
    history: (ref: string, file: string) =>
      `history/${encodeRef(ref)}/${encodeRef(file)}`, // path-ok: encodeRef encodes each segment
    preference: 'diff/preference',
    preferenceSet: 'diff/preference/set',
  },
  // User/group search
  users: {
    search: '-/users/search',
  },
  groups: {
    list: '-/groups',
  },
} as const

export default endpoints
