import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { requestHelpers } from '@mochi/common'
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
export function useRepoInfo() {
  return useQuery({
    queryKey: repoKeys.info(),
    queryFn: () => requestHelpers.get<InfoResponse>(endpoints.repo.info),
  })
}

export function useBranches(repoId: string) {
  return useQuery({
    queryKey: repoKeys.branches(repoId),
    queryFn: () => requestHelpers.get<BranchesResponse>(endpoints.repo.branches(repoId)),
    enabled: !!repoId,
  })
}

export function useTags(repoId: string) {
  return useQuery({
    queryKey: repoKeys.tags(repoId),
    queryFn: () => requestHelpers.get<TagsResponse>(endpoints.repo.tags(repoId)),
    enabled: !!repoId,
  })
}

export function useCommits(repoId: string, ref?: string) {
  return useQuery({
    queryKey: repoKeys.commits(repoId, ref),
    queryFn: () => requestHelpers.get<CommitsResponse>(endpoints.repo.commits(repoId, ref)),
    enabled: !!repoId,
  })
}

export function useCommit(repoId: string, sha: string) {
  return useQuery({
    queryKey: repoKeys.commit(repoId, sha),
    queryFn: () => requestHelpers.get<CommitResponse>(endpoints.repo.commit(repoId, sha)),
    enabled: !!repoId && !!sha,
  })
}

export function useTree(repoId: string, ref: string, path?: string) {
  return useQuery({
    queryKey: repoKeys.tree(repoId, ref, path),
    queryFn: () => requestHelpers.get<TreeResponse>(endpoints.repo.tree(repoId, ref, path)),
    enabled: !!repoId && !!ref,
  })
}

export function useBlob(repoId: string, ref: string, path: string) {
  return useQuery({
    queryKey: repoKeys.blob(repoId, ref, path),
    queryFn: () => requestHelpers.get<BlobResponse>(endpoints.repo.blob(repoId, ref, path)),
    enabled: !!repoId && !!ref && !!path,
  })
}

export function useCreateRepo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateRepoRequest) =>
      requestHelpers.post<CreateRepoResponse>(endpoints.repo.create, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: repoKeys.info() })
    },
  })
}

export function useDeleteRepo(repoId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => requestHelpers.post<{ success: boolean }>(endpoints.repo.delete(repoId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: repoKeys.info() })
    },
  })
}
