const endpoints = {
  // Repository operations
  repo: {
    // Class-level endpoints (no entity context)
    info: '-/info',
    create: '-/create',

    // Entity-level endpoints (caller should set baseURL to /{repoId}/-/)
    settings: 'settings',
    settingsSet: 'settings/set',
    delete: 'delete',
    // Access control
    access: 'access',
    accessSet: 'access/set',
    accessRevoke: 'access/revoke',
    // Git operations
    refs: 'refs',
    branches: 'branches',
    branchCreate: 'branches/create',
    branchDelete: 'branches/delete',
    tags: 'tags',
    commits: (ref?: string) => ref ? `commits/${ref}` : 'commits',
    commit: (sha: string) => `commit/${sha}`,
    tree: (ref: string, path?: string) => path ? `tree/${ref}/${path}` : `tree/${ref}`,
    blob: (ref: string, path: string) => `blob/${ref}/${path}`,
  },
  // User/group search
  users: {
    search: '-/users/search',
  },
  groups: {
    list: '-/groups',
  },
} as const

export type Endpoints = typeof endpoints

export default endpoints
