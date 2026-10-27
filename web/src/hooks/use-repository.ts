// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { useState } from 'react'
import {
  infiniteQueryOptions,
  useInfiniteQuery,
  useQuery,
  useQueries,
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { naturalCompare, type DiffViewStyle } from '@mochi/web'
import endpoints from '@/api/endpoints'
import { reposRequest, appBasePath } from '@/api/request'
import type { CommitSearch, CompareSearch } from '@/lib/diff-options'
import type {
  InfoResponse,
  BranchesResponse,
  TagsResponse,
  Commit,
  CommitsResponse,
  CommitResponse,
  TreeResponse,
  BlobResponse,
  DiffMode,
  DiffResponse,
  HistoryResponse,
  CreateRepoRequest,
  CreateRepoResponse,
  SubscribeResponse,
  UnsubscribeResponse,
} from '@/api/types'

// Query keys
export const repoKeys = {
  all: ['repositories'] as const,
  info: () => [...repoKeys.all, 'info'] as const,
  branches: (id: string) => [...repoKeys.all, id, 'branches'] as const,
  tags: (id: string) => [...repoKeys.all, id, 'tags'] as const,
  commits: (id: string, ref?: string) =>
    [...repoKeys.all, id, 'commits', ref] as const,
  commit: (id: string, sha: string) =>
    [...repoKeys.all, id, 'commit', sha] as const,
  tree: (id: string, ref: string, path?: string) =>
    [...repoKeys.all, id, 'tree', ref, path] as const,
  blob: (id: string, ref: string, path: string) =>
    [...repoKeys.all, id, 'blob', ref, path] as const,
  diff: (id: string, request: DiffRequest) =>
    [...repoKeys.all, id, 'diff', request] as const,
  history: (id: string, ref: string, path: string, limit: number) =>
    [...repoKeys.all, id, 'history', ref, path, limit] as const,
  preference: () => [...repoKeys.all, 'diff', 'preference'] as const,
}

export interface DiffRequest {
  // Empty asks for head's own changes: from its first parent, or from nothing
  // for a first commit.
  base: string
  head: string
  mode: DiffMode
  // Limits the comparison to one file or folder.
  path?: string
  // Also list the commits head adds, as the compare page does.
  commits?: boolean
}

// A full commit hash names one unchanging commit, so a comparison of two of
// them never goes stale.
const isCommit = (ref: string) => /^[0-9a-f]{40}$/i.test(ref)

// How long an answer about a branch or tag - its files, its commits, a
// comparison - is taken as current: long enough for a page to take up the one
// its route loader fetched rather than ask again, short enough that a push
// shows on the next visit.
const REF_FRESH = 10_000

// The same for an answer at a ref that may be a full commit hash, which never
// changes.
const refFresh = (ref: string) => (isCommit(ref) ? Infinity : REF_FRESH)

// Commits a file's history shows at first, and how many more each Load more
// asks for.
export const HISTORY_PAGE = 100

// The diff a commit page shows: the commit's own changes, from the parent its
// address names, or else from its first, which the server picks so that the
// page can ask before it has read the commit.
export function commitDiffRequest(
  sha: string,
  search: CommitSearch
): DiffRequest {
  return {
    base: search.parent ?? '',
    head: sha,
    mode: 'direct',
    path: search.path,
  }
}

// The diff a compare page shows, with the commits head adds. Comparing from
// where the two split is the default.
export function compareDiffRequest(
  base: string,
  head: string,
  search: CompareSearch
): DiffRequest {
  return {
    base,
    head,
    mode: search.mode ?? 'diverged',
    path: search.path,
    commits: true,
  }
}

// The requests behind the hooks below. A route loader starts them too, before
// the repository's info has arrived, and names the repository with baseURL,
// since a loader runs before the page's address changes.
export function getBranches(baseURL?: string) {
  return reposRequest.get<BranchesResponse>(endpoints.repo.branches, {
    baseURL,
  })
}

export function getTags(baseURL?: string) {
  return reposRequest.get<TagsResponse>(endpoints.repo.tags, { baseURL })
}

// The server's default page. A shorter page is the last one.
const COMMITS_PAGE_SIZE = 50

// No ref, here and in getTree, is the default branch the repository's info
// names, which a loader can ask for before the info arrives.
export async function getCommits(
  ref: string | undefined,
  offset: number,
  baseURL?: string
): Promise<Commit[]> {
  const response = await reposRequest.get<CommitsResponse>(
    endpoints.repo.commits(ref),
    { baseURL, params: { limit: COMMITS_PAGE_SIZE, offset } }
  )
  return response.commits ?? []
}

export function getTree(ref: string, path?: string, baseURL?: string) {
  return reposRequest.get<TreeResponse>(endpoints.repo.tree(ref, path), {
    baseURL,
  })
}

export function getBlob(ref: string, path: string, baseURL?: string) {
  return reposRequest.get<BlobResponse>(endpoints.repo.blob(ref, path), {
    baseURL,
  })
}

export function getCommit(sha: string, baseURL?: string) {
  return reposRequest.get<CommitResponse>(endpoints.repo.commit(sha), {
    baseURL,
  })
}

export function getDiff(request: DiffRequest, baseURL?: string) {
  return reposRequest.get<DiffResponse>(endpoints.repo.diff, {
    baseURL,
    params: {
      base: request.base,
      head: request.head,
      mode: request.mode,
      path: request.path || undefined,
      commits: request.commits ? 'true' : undefined,
    },
  })
}

export function getHistory(
  ref: string,
  path: string,
  limit: number,
  baseURL?: string
) {
  return reposRequest.get<HistoryResponse>(endpoints.repo.history(ref, path), {
    baseURL,
    params: { limit },
  })
}

// A request a route loader started alongside the repository's info. A page
// that never takes it up - the info failed - must not see it as an unhandled
// rejection; a page that does gets any failure through the query.
export function startRequest<T>(request: Promise<T>): Promise<T> {
  request.catch(() => undefined)
  return request
}

// Hands a request a route loader started to the query cache under the key the
// page's hook uses, so the hook takes it up rather than asking again. It
// silences query/exhaustive-deps: the key is the hook's, which already names
// what the request asks for.
export function primeQuery<T>(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  request: Promise<T>
) {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  void queryClient.prefetchQuery({ queryKey, queryFn: () => request })
}

// primeQuery for the commit list, which comes in pages: the request is its
// first. The rest are asked for as the page's own hook asks for them. A
// prefetch's options replace the query's, so priming with less than the
// hook's - no next page, every page the first - made the refetch of a list
// read further than one page throw on returning to it.
export function primeCommits(
  queryClient: QueryClient,
  repoId: string,
  ref: string,
  request: Promise<Commit[]>,
  baseURL?: string
) {
  void queryClient.prefetchInfiniteQuery({
    ...commitsQuery(repoId, ref, baseURL),
    queryFn: ({ pageParam }) =>
      pageParam === 0 ? request : getCommits(ref, pageParam, baseURL),
  })
}

// Hooks

// useRepoInfo fetches class-level info (list of all repositories)
// Uses explicit class-level baseURL to work correctly from any page
export function useRepoInfo() {
  return useQuery({
    queryKey: repoKeys.info(),
    queryFn: () =>
      reposRequest.get<InfoResponse>(endpoints.repo.info, {
        baseURL: appBasePath(),
      }),
  })
}

export function useBranches(repoId: string) {
  return useQuery({
    queryKey: repoKeys.branches(repoId),
    queryFn: () => getBranches(),
    enabled: !!repoId,
    staleTime: REF_FRESH,
    select: (response) => ({
      ...response,
      branches: [...response.branches].sort((a, b) =>
        naturalCompare(a.name, b.name)
      ),
    }),
  })
}

export function useTags(repoId: string) {
  return useQuery({
    queryKey: repoKeys.tags(repoId),
    queryFn: () => getTags(),
    enabled: !!repoId,
    staleTime: REF_FRESH,
    select: (response) => ({
      ...response,
      tags: [...response.tags].sort((a, b) => naturalCompare(a.name, b.name)),
    }),
  })
}

// The deepest offset the server lists commits from; past it the list ends.
const COMMITS_OFFSET_MAXIMUM = 10000

// The commit list's query, shared by the page's hook and the loaders that
// prime it, so a list a loader refetches is asked for page by page as the hook
// would ask.
export function commitsQuery(
  repoId: string,
  ref: string | undefined,
  baseURL?: string
) {
  // baseURL is where the list is asked for, not which list it is.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return infiniteQueryOptions({
    queryKey: repoKeys.commits(repoId, ref),
    queryFn: ({ pageParam }: { pageParam: number }) =>
      getCommits(ref, pageParam, baseURL),
    initialPageParam: 0,
    staleTime: refFresh(ref ?? ''),
    // The offset counts what was asked for, not what the list kept after
    // dropping repeats, so it always lands on the server's next page.
    getNextPageParam: (lastPage: Commit[], allPages: Commit[][]) => {
      const next = allPages.length * COMMITS_PAGE_SIZE
      return lastPage.length < COMMITS_PAGE_SIZE ||
        next > COMMITS_OFFSET_MAXIMUM
        ? undefined
        : next
    },
  })
}

export function useCommits(repoId: string, ref?: string) {
  return useInfiniteQuery({
    ...commitsQuery(repoId, ref),
    enabled: !!repoId,
  })
}

export function useCommit(repoId: string, sha: string) {
  return useQuery({
    queryKey: repoKeys.commit(repoId, sha),
    queryFn: () => getCommit(sha),
    enabled: !!repoId && !!sha,
    // A commit named by its full hash never changes.
    staleTime: isCommit(sha) ? Infinity : 0,
  })
}

export function useTree(repoId: string, ref: string, path?: string) {
  return useQuery({
    queryKey: repoKeys.tree(repoId, ref, path),
    queryFn: () => getTree(ref, path),
    enabled: !!repoId && !!ref,
    staleTime: refFresh(ref),
    retry: false,
  })
}

export function useBlob(repoId: string, ref: string, path: string) {
  return useQuery({
    queryKey: repoKeys.blob(repoId, ref, path),
    queryFn: () => getBlob(ref, path),
    enabled: !!repoId && !!ref && !!path,
    staleTime: refFresh(ref),
    retry: false,
  })
}

export function useDiff(repoId: string, request: DiffRequest) {
  return useQuery({
    queryKey: repoKeys.diff(repoId, request),
    queryFn: () => getDiff(request),
    enabled: !!repoId && !!request.head,
    staleTime:
      isCommit(request.head) && (!request.base || isCommit(request.base))
        ? Infinity
        : REF_FRESH,
    retry: false,
  })
}

export function useHistory(
  repoId: string,
  ref: string,
  path: string,
  limit: number
) {
  return useQuery({
    queryKey: repoKeys.history(repoId, ref, path, limit),
    queryFn: () => getHistory(ref, path, limit),
    enabled: !!repoId && !!ref && !!path,
    staleTime: refFresh(ref),
    placeholderData: (previous) => previous,
    retry: false,
  })
}

// The one or two column choice for diffs. It is the person's preference,
// shared with projects and wikis, so it follows them between apps and devices.
// A visitor who is not signed in has nowhere to keep it, and the choice lasts
// as long as the page.
export function useDiffStyle(): [
  DiffViewStyle,
  (style: DiffViewStyle) => void,
] {
  const queryClient = useQueryClient()
  const [local, setLocal] = useState<DiffViewStyle>()
  const { data } = useQuery({
    queryKey: repoKeys.preference(),
    queryFn: () =>
      reposRequest.get<{ style: DiffViewStyle }>(endpoints.repo.preference),
    staleTime: Infinity,
    retry: false,
  })
  const save = useMutation({
    mutationFn: (style: DiffViewStyle) =>
      reposRequest.post<{ style: DiffViewStyle }>(
        endpoints.repo.preferenceSet,
        { style }
      ),
    onSuccess: (answer) =>
      queryClient.setQueryData(repoKeys.preference(), answer),
  })
  const style = local ?? data?.style ?? 'unified'
  return [
    style,
    (next) => {
      setLocal(next)
      save.mutate(next)
    },
  ]
}

// Both sides of one changed file, for comparing it again in the browser with
// other options. A side that does not exist (the file was added, deleted, or
// the comparison starts from nothing) reads as empty text. content is null
// when either side is binary or too large for the server to send.
export function useFileSides(
  repoId: string,
  before: { ref: string; path: string } | undefined,
  after: { ref: string; path: string } | undefined,
  enabled: boolean
) {
  const sides = [before, after]
  const results = useQueries({
    queries: sides.map((side) => ({
      queryKey: repoKeys.blob(repoId, side?.ref ?? '', side?.path ?? ''),
      queryFn: () => getBlob(side!.ref, side!.path),
      enabled: enabled && !!side,
      staleTime: Infinity,
      retry: false,
    })),
  })
  const content = (index: number): string | null | undefined => {
    if (!sides[index]) return ''
    const data = results[index].data
    if (!data) return undefined
    return data.binary ? null : (data.content ?? null)
  }
  return {
    before: content(0),
    after: content(1),
    isLoading: results.some((result) => result.isLoading),
    error: results.find((result) => result.error)?.error,
  }
}

export function useCreateRepo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateRepoRequest) =>
      reposRequest.post<CreateRepoResponse>(endpoints.repo.create, data, {
        baseURL: appBasePath(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: repoKeys.info() })
    },
  })
}

export function useCreateBranch(repoId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { name: string; source: string }) =>
      reposRequest.post<{ success: boolean; name: string }>(
        endpoints.repo.branchCreate,
        data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: repoKeys.branches(repoId) })
    },
  })
}

export function useDeleteBranch(repoId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (name: string) =>
      reposRequest.post<{ success: boolean }>(endpoints.repo.branchDelete, {
        name,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: repoKeys.branches(repoId) })
    },
  })
}

// Subscribe to a repository
export function useSubscribe() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      repository: string
      server?: string
      peer?: string
    }) =>
      reposRequest.post<SubscribeResponse>(endpoints.repo.subscribe, data, {
        baseURL: appBasePath(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: repoKeys.info() })
    },
  })
}

// Unsubscribe from a repository
export function useUnsubscribe() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (repository: string) =>
      reposRequest.post<UnsubscribeResponse>(
        endpoints.repo.unsubscribe,
        { repository },
        { baseURL: appBasePath() }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: repoKeys.info() })
    },
  })
}
