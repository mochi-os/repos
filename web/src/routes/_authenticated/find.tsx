// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useCallback, useMemo } from 'react'
import { useLingui } from '@lingui/react/macro'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FolderGit2 } from 'lucide-react'
import { FindEntityPage, toastAction, getErrorMessage, callWithServerFallback } from '@mochi/web'
import { useRepoInfo, useSubscribe, repoKeys } from '@/hooks/use-repository'
import { reposRequest, appBasePath } from '@/api/request'
import endpoints from '@/api/endpoints'
import type { RecommendationsResponse } from '@/api/types'

export const Route = createFileRoute('/_authenticated/find')({
  component: FindRepositoriesPage,
})

function FindRepositoriesPage() {
  const { t } = useLingui()
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

  const handleSubscribe = useCallback(async (repoId: string, entity: { location?: string }) => {
    try {
      await toastAction(
        callWithServerFallback(
          (server) =>
            subscribe.mutateAsync({
              repository: repoId,
              server,
            }),
          entity.location,
        ),
        {
          loading: t`Subscribing...`,
          success: t`Subscribed`,
          error: (e) => getErrorMessage(e, t`Failed to subscribe`),
        }
      )
      await queryClient.invalidateQueries({ queryKey: repoKeys.info() })
      void navigate({ to: '/$repoId', params: { repoId } })
    } catch {
      // toast already shown
    }
  }, [subscribe, queryClient, navigate, t])

  return (
    <FindEntityPage
      onSubscribe={handleSubscribe}
      subscribedIds={subscribedRepoIds}
      entityClass="repository"
      searchEndpoint={`${appBasePath()}-/search`}
      icon={FolderGit2}
      iconClassName="bg-primary/10 text-primary"
      title={t`Find repositories`}
      placeholder={t`Search by name, ID, fingerprint, or URL...`}
      emptyMessage={t`No repositories found`}
      recommendations={recommendations}
      isLoadingRecommendations={isLoadingRecommendations}
      isRecommendationsError={isRecommendationsError}
    />
  )
}
