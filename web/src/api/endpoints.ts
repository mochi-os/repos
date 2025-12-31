const endpoints = {
  // Repository operations
  repo: {
    // Class-level endpoints (no entity context)
    info: '-/info',
    create: '-/create',

    // Entity-level endpoints (use /-/ separator)
    settings: (id: string) => `${id}/-/settings`,
    settingsSet: (id: string) => `${id}/-/settings/set`,
    delete: (id: string) => `${id}/-/delete`,
    // Access control
    access: (id: string) => `${id}/-/access`,
    accessSet: (id: string) => `${id}/-/access/set`,
    accessRevoke: (id: string) => `${id}/-/access/revoke`,
    // Git operations
    refs: (id: string) => `${id}/-/refs`,
    branches: (id: string) => `${id}/-/branches`,
    tags: (id: string) => `${id}/-/tags`,
    commits: (id: string, ref?: string) => ref ? `${id}/-/commits/${ref}` : `${id}/-/commits`,
    commit: (id: string, sha: string) => `${id}/-/commit/${sha}`,
    tree: (id: string, ref: string, path?: string) =>
      path ? `${id}/-/tree/${ref}/${path}` : `${id}/-/tree/${ref}`,
    blob: (id: string, ref: string, path: string) => `${id}/-/blob/${ref}/${path}`,
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
