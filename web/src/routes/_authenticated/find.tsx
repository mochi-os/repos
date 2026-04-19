import { useCallback, useMemo } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FolderGit2 } from 'lucide-react'
import { FindEntityPage, toast, getErrorMessage } from '@mochi/web'
import { useRepoInfo, useSubscribe, repoKeys } from '@/hooks/use-repository'
import { reposRequest, appBasePath } from '@/api/request'
import endpoints from '@/api/endpoints'
import type { RecommendationsResponse } from '@/api/types'

export const Route = createFileRoute('/_authenticated/find')({
  component: FindRepositoriesPage,
})

function FindRepositoriesPage() {
  const { data } = useRepoInfo()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const subscribe = useSubscribe()

  // Recommendations query
  const {
    data: recommendationsData,
    isLoading: isLoadingRecommendations,
    isError: isRecommendationsError,
  } = useQuery({
    queryKey: ['repositories', 'recommendations'],
    queryFn: () => reposRequest.get<RecommendationsResponse>(endpoints.repo.recommendations, { baseURL: appBasePath() }),
    retry: false,
    refetchOnWindowFocus: false,
  })
  const recommendations = recommendationsData?.repositories ?? []

  const repositories = useMemo(() => data?.repositories ?? [], [data?.repositories])

  const subscribedRepoIds = useMemo(
    () => new Set(
      repositories.flatMap((r) => [r.id, r.fingerprint].filter((x): x is string => !!x))
    ),
    [repositories]
  )

  const handleSubscribe = useCallback(async (repoId: string) => {
    try {
      await subscribe.mutateAsync({ repository: repoId })
      toast.success('Subscribed')
      await queryClient.invalidateQueries({ queryKey: repoKeys.info() })
      void navigate({ to: '/$repoId', params: { repoId } })
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to subscribe'))
    }
  }, [subscribe, queryClient, navigate])

  return (
    <FindEntityPage
      onSubscribe={handleSubscribe}
      subscribedIds={subscribedRepoIds}
      entityClass="repository"
      searchEndpoint={`${appBasePath()}-/search`}
      icon={FolderGit2}
      iconClassName="bg-primary/10 text-primary"
      title="Find repositories"
      placeholder="Search by name, ID, fingerprint, or URL..."
      emptyMessage="No repositories found"
      recommendations={recommendations}
      isLoadingRecommendations={isLoadingRecommendations}
      isRecommendationsError={isRecommendationsError}
    />
  )
}
