import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reposRequest } from '@/api/request'
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

function repoBaseURL(repoId: string) {
  return { baseURL: `/${repoId}/-/` }
}

export function useBranches(repoId: string) {
  return useQuery({
    queryKey: repoKeys.branches(repoId),
    queryFn: () => reposRequest.get<BranchesResponse>(endpoints.repo.branches, repoBaseURL(repoId)),
    enabled: !!repoId,
  })
}

export function useTags(repoId: string) {
  return useQuery({
    queryKey: repoKeys.tags(repoId),
    queryFn: () => reposRequest.get<TagsResponse>(endpoints.repo.tags, repoBaseURL(repoId)),
    enabled: !!repoId,
  })
}

export function useCommits(repoId: string, ref?: string) {
  return useQuery({
    queryKey: repoKeys.commits(repoId, ref),
    queryFn: () => reposRequest.get<CommitsResponse>(endpoints.repo.commits(ref), repoBaseURL(repoId)),
    enabled: !!repoId,
  })
}

export function useCommit(repoId: string, sha: string) {
  return useQuery({
    queryKey: repoKeys.commit(repoId, sha),
    queryFn: () => reposRequest.get<CommitResponse>(endpoints.repo.commit(sha), repoBaseURL(repoId)),
    enabled: !!repoId && !!sha,
  })
}

export function useTree(repoId: string, ref: string, path?: string) {
  return useQuery({
    queryKey: repoKeys.tree(repoId, ref, path),
    queryFn: () => reposRequest.get<TreeResponse>(endpoints.repo.tree(ref, path), repoBaseURL(repoId)),
    enabled: !!repoId && !!ref,
  })
}

export function useBlob(repoId: string, ref: string, path: string) {
  return useQuery({
    queryKey: repoKeys.blob(repoId, ref, path),
    queryFn: () => reposRequest.get<BlobResponse>(endpoints.repo.blob(ref, path), repoBaseURL(repoId)),
    enabled: !!repoId && !!ref && !!path,
  })
}

export function useCreateRepo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateRepoRequest) =>
      reposRequest.post<CreateRepoResponse>(endpoints.repo.create, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: repoKeys.info() })
    },
  })
}

export function useDeleteRepo(repoId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => reposRequest.post<{ success: boolean }>(endpoints.repo.delete, undefined, repoBaseURL(repoId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: repoKeys.info() })
    },
  })
}
