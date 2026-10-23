// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

// Repository types

export interface Repository {
  id: string
  fingerprint: string
  name: string
  path: string
  description: string
  default_branch: string
  size: number
  owner: number // 1 = locally owned, 0 = subscribed remote
  server: string // Remote server URL (empty for local repos)
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
  path?: string
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
  owner?: number
  server?: string
  remote?: boolean
  repositories?: Repository[]
}

// Search/subscription types
export interface SearchResult {
  id: string
  fingerprint: string
  name: string
  class?: string
  server?: string
  /** owner's peer from a mochi:// share-link probe; subscribe pins the same peer. */
  peer?: string
  remote?: boolean
  description?: string
}

export interface SearchResponse {
  results: SearchResult[]
}

export interface SubscribeResponse {
  fingerprint: string
  name: string
}

export interface UnsubscribeResponse {
  success: boolean
}

interface Branch {
  name: string
  sha: string
  ahead?: number
  behind?: number
}

interface Tag {
  name: string
  sha: string
  message?: string
  tagger?: string
  date?: number
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
  email?: string
  date: number
  parents?: string[]
}

export interface CommitsResponse {
  commits: Commit[]
}

export interface CommitResponse {
  commit: Commit
}

// How two commits are compared: from where their histories split, so only
// what head adds shows, or as the two stand.
export type DiffMode = 'diverged' | 'direct'

export interface DiffResponse {
  // The commits the request's refs named. base is empty for a first commit,
  // which is compared with nothing.
  base: string
  head: string
  // Where the comparison starts: base, or where base and head split.
  start: string
  diff: string
  commits: Commit[]
}

export interface HistoryResponse {
  ref: string
  path: string
  commits: Commit[]
}

export interface TreeEntry {
  name: string
  type: 'blob' | 'tree' | 'dir' | 'file'
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

export interface CreateRepoRequest {
  name: string
  path: string
  description?: string
  allow_read?: string
  privacy?: string
}

export interface CreateRepoResponse {
  id: string
  fingerprint: string
  name: string
  path: string
  url: string
}

export interface RecommendedRepository {
  id: string
  name: string
  blurb: string
  fingerprint: string
  server: string
}

export interface RecommendationsResponse {
  repositories: RecommendedRepository[]
}
