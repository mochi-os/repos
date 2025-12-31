// Repository types

export interface Repository {
  id: string
  fingerprint: string
  name: string
  description: string
  default_branch: string
  size: number
  created: string
  updated: string
  branches?: number
  tags?: number
}

export interface InfoResponse {
  entity: boolean
  id?: string
  fingerprint?: string
  name?: string
  description?: string
  default_branch?: string
  size?: number
  created?: string
  updated?: string
  branches?: number
  tags?: number
  allow_read?: boolean
  privacy?: string
  isAdmin?: boolean
  repositories?: Repository[]
}

export interface Branch {
  name: string
  sha: string
  ahead?: number
  behind?: number
}

export interface Tag {
  name: string
  sha: string
  message?: string
  tagger?: string
  date?: string
}

export interface BranchesResponse {
  branches: Branch[]
  default: string
}

export interface TagsResponse {
  tags: Tag[]
}

export interface Commit {
  sha: string
  message: string
  author: string
  author_email?: string
  date: string
  parents?: string[]
}

export interface CommitsResponse {
  commits: Commit[]
}

export interface CommitResponse {
  commit: Commit & {
    diff?: string
    stats?: {
      files: number
      additions: number
      deletions: number
    }
  }
}

export interface TreeEntry {
  name: string
  type: 'blob' | 'tree'
  sha: string
  size?: number
  mode?: string
}

export interface TreeResponse {
  ref: string
  path: string
  entries: TreeEntry[]
}

export interface BlobResponse {
  ref: string
  path: string
  sha: string
  size: number
  binary: boolean
  content?: string
}

export interface AccessEntry {
  subject: string
  permission: string
  owner?: string
}

export interface AccessResponse {
  access: AccessEntry[]
}

export interface CreateRepoRequest {
  name: string
  description?: string
  allow_read?: string
  privacy?: string
}

export interface CreateRepoResponse {
  id: string
  fingerprint: string
  name: string
  url: string
}
