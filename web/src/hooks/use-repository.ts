import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reposRequest, appBasePath } from '@/api/request'
import endpoints from '@/api/endpoints'
import type {
  InfoResponse,
  BranchesResponse,
  TagsResponse,
  CommitsResponse,
  CommitResponse,
  TreeResponse,
  BlobResponse,
  CreateRepoRequest,
  CreateRepoResponse,
  SearchResponse,
  ProbeResponse,
  SubscribeResponse,
  UnsubscribeResponse,
} from '@/api/types'

// Query keys
export const repoKeys = {
  all: ['repositories'] as const,
  info: () => [...repoKeys.all, 'info'] as const,
  branches: (id: string) => [...repoKeys.all, id, 'branches'] as const,
  tags: (id: string) => [...repoKeys.all, id, 'tags'] as const,
  commits: (id: string, ref?: string) => [...repoKeys.all, id, 'commits', ref] as const,
  commit: (id: string, sha: string) => [...repoKeys.all, id, 'commit', sha] as const,
  tree: (id: string, ref: string, path?: string) => [...repoKeys.all, id, 'tree', ref, path] as const,
  blob: (id: string, ref: string, path: string) => [...repoKeys.all, id, 'blob', ref, path] as const,
}

// Hooks

// useRepoInfo fetches class-level info (list of all repositories)
// Uses explicit class-level baseURL to work correctly from any page
export function useRepoInfo() {
  return useQuery({
    queryKey: repoKeys.info(),
    queryFn: () => reposRequest.get<InfoResponse>(endpoints.repo.info, { baseURL: '/repositories/' }),
  })
}

export function useBranches(repoId: string) {
  return useQuery({
    queryKey: repoKeys.branches(repoId),
    queryFn: () => reposRequest.get<BranchesResponse>(endpoints.repo.branches),
    enabled: !!repoId,
  })
}

export function useTags(repoId: string) {
  return useQuery({
    queryKey: repoKeys.tags(repoId),
    queryFn: () => reposRequest.get<TagsResponse>(endpoints.repo.tags),
    enabled: !!repoId,
  })
}

export function useCommits(repoId: string, ref?: string) {
  return useQuery({
    queryKey: repoKeys.commits(repoId, ref),
    queryFn: () => reposRequest.get<CommitsResponse>(endpoints.repo.commits(ref)),
    enabled: !!repoId,
  })
}

export function useCommit(repoId: string, sha: string) {
  return useQuery({
    queryKey: repoKeys.commit(repoId, sha),
    queryFn: () => reposRequest.get<CommitResponse>(endpoints.repo.commit(sha)),
    enabled: !!repoId && !!sha,
  })
}

export function useTree(repoId: string, ref: string, path?: string) {
  return useQuery({
    queryKey: repoKeys.tree(repoId, ref, path),
    queryFn: () => reposRequest.get<TreeResponse>(endpoints.repo.tree(ref, path)),
    enabled: !!repoId && !!ref,
    retry: false,
  })
}

export function useBlob(repoId: string, ref: string, path: string) {
  return useQuery({
    queryKey: repoKeys.blob(repoId, ref, path),
    queryFn: () => reposRequest.get<BlobResponse>(endpoints.repo.blob(ref, path)),
    enabled: !!repoId && !!ref && !!path,
    retry: false,
  })
}

export function useCreateRepo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateRepoRequest) =>
      reposRequest.post<CreateRepoResponse>(endpoints.repo.create, data, { baseURL: appBasePath() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: repoKeys.info() })
    },
  })
}

export function useDeleteRepo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => reposRequest.post<{ success: boolean }>(endpoints.repo.delete),
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
        endpoints.repo.branchCreate, data
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
      reposRequest.post<{ success: boolean }>(
        endpoints.repo.branchDelete, { name }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: repoKeys.branches(repoId) })
    },
  })
}

// Search for repositories
export function useSearchRepos(query: string) {
  return useQuery({
    queryKey: ['repositories', 'search', query],
    queryFn: () => reposRequest.get<SearchResponse>(
      `${endpoints.repo.search}?search=${encodeURIComponent(query)}`,
      { baseURL: '/repositories/' }
    ),
    enabled: query.length >= 1,
  })
}

// Probe a remote repository
export function useProbeRepo() {
  return useMutation({
    mutationFn: (url: string) =>
      reposRequest.post<ProbeResponse>(endpoints.repo.probe, { url }, { baseURL: '/repositories/' }),
  })
}

// Subscribe to a repository
export function useSubscribe() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { repository: string; server?: string }) =>
      reposRequest.post<SubscribeResponse>(endpoints.repo.subscribe, data, { baseURL: '/repositories/' }),
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
      reposRequest.post<UnsubscribeResponse>(endpoints.repo.unsubscribe, { repository }, { baseURL: '/repositories/' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: repoKeys.info() })
    },
  })
}

