// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

// Encode a ref or path for a URL segment while keeping its slashes. The tree
// and blob routes take a splat, so "/" separates segments and has to survive,
// but a "#", "?" or "%" in a branch or file name truncates the request.
const encodeRef = (value: string) =>
  value
    .split('/')
    .map((part) => encodeURIComponent(part))
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
    share: (repoId: string) => `${repoId}/-/share`,
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
    commits: (ref?: string) => (ref ? `commits/${encodeRef(ref)}` : 'commits'),
    commit: (sha: string) => `commit/${encodeURIComponent(sha)}`,
    tree: (ref: string, path?: string) =>
      path
        ? `tree/${encodeRef(ref)}/${encodeRef(path)}`
        : `tree/${encodeRef(ref)}`,
    blob: (ref: string, path: string) =>
      `blob/${encodeRef(ref)}/${encodeRef(path)}`,
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
