// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { createFileRoute, redirect, Link, useRouter } from '@tanstack/react-router'
import { Trans, useLingui } from '@lingui/react/macro'
import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Header,
  Main,
  PageHeader,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  usePageTitle,
  useAuthStore,
  GeneralError,
  toastAction,
  getErrorMessage,
  callWithServerFallback,
  naturalCompare,
  isDomainEntityRouting,
} from '@mochi/web'
import { Plus, FolderGit2, Loader2, MoreHorizontal } from 'lucide-react'
import { reposRequest, appBasePath } from '@/api/request'
import endpoints from '@/api/endpoints'
import type { InfoResponse, Repository, RecommendationsResponse, RecommendedRepository } from '@/api/types'
import { RepositoryTabs, CloneDialog, UnsubscribeButton, type RepositoryTabId } from '@/features/repository/repository-tabs'
import { DownloadDropdown } from '@/components/download-dropdown'
import { getLastRepo, clearLastRepo, setLastRepo } from '@/hooks/use-repos-storage'
import { useSidebarContext } from '@/context/sidebar-context'
import { InlineRepoSearch } from '@/features/repository/inline-repo-search'
import { useSubscribe, useUnsubscribe } from '@/hooks/use-repository'

const validTabs: RepositoryTabId[] = ['files', 'commits', 'branches', 'tags', 'settings', 'access']

type IndexSearch = {
  tab?: RepositoryTabId
}

// Module-level flag to track if we've already done initial redirect check (resets on page refresh)
let hasCheckedRedirect = false

export const Route = createFileRoute('/_authenticated/')({
  validateSearch: (search: Record<string, unknown>): IndexSearch => ({
    tab: validTabs.includes(search.tab as RepositoryTabId) ? (search.tab as RepositoryTabId) : undefined,
  }),
  loader: async () => {
    const info = await reposRequest.get<InfoResponse>(endpoints.repo.info, { baseURL: appBasePath() })

    // Only redirect on first load, not on subsequent navigations
    if (hasCheckedRedirect) {
      return info
    }
    hasCheckedRedirect = true

    // In class context, check for last visited repository and redirect if it still exists
    // Skip redirect on domain-routed pages (e.g. git.mochi-os.org/) where the listing is the main view
    // Only for authenticated users — unauthenticated users should always see the listing
    if (!info.entity && !isDomainEntityRouting() && useAuthStore.getState().isAuthenticated) {
      const lastRepoId = await getLastRepo()
      if (lastRepoId) {
        const repos = info.repositories || []
        const repoExists = repos.some(r => r.id === lastRepoId || r.fingerprint === lastRepoId)
        if (repoExists) {
          throw redirect({ to: '/$repoId', params: { repoId: lastRepoId } })
        } else {
          clearLastRepo()
        }
      }
    }

    return info
  },
  component: IndexPage,
  errorComponent: ({ error }) => <GeneralError error={error} />,
})

function IndexPage() {
  const data = Route.useLoaderData()

  // If we're in entity context, show the repository file browser
  if (data.entity && data.id) {
    return <RepositoryHomePage data={data} />
  }

  // Class context - show repository list
  return <RepositoryListPage repositories={data.repositories} />
}

function RepositoryHomePage({ data }: { data: InfoResponse }) {
  const { t } = useLingui()
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()

  const setActiveTab = (newTab: RepositoryTabId) => {
    void navigate({ search: { tab: newTab }, replace: true })
  }

  const name = data.name || t`Repository`
  const fingerprint = data.fingerprint || data.id!
  usePageTitle(name)

  return (
    <>
      <Header className="border-b-0">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderGit2 className="h-5 w-5" />
            <h1 className="text-lg font-semibold">{name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <CloneDialog repoPath={data.path || ''} fingerprint={fingerprint} />
            {(tab ?? 'files') === 'files' && (
              <DownloadDropdown gitRef={data.default_branch || 'HEAD'} />
            )}
            {data.remote && (
              <UnsubscribeButton repoId={data.id!} repoName={name} />
            )}
          </div>
        </div>
      </Header>
      <Main spacingY="xs">
        <RepositoryTabs
          repoId={data.id!}
          fingerprint={fingerprint}
          name={name}
          path={data.path || ''}
          defaultBranch={data.default_branch || 'main'}
          description={data.description}
          isOwner={data.isAdmin}
          activeTab={tab ?? 'files'}
          onTabChange={setActiveTab}
        />
      </Main>
    </>
  )
}

interface RepositoryListPageProps {
  repositories?: Repository[]
}

function RepositoryListPage({ repositories }: RepositoryListPageProps) {
  const { t } = useLingui()
  usePageTitle(t`Repositories`)
  const { openCreateDialog } = useSidebarContext()
  const queryClient = useQueryClient()
  const router = useRouter()
  const subscribe = useSubscribe()
  const unsubscribe = useUnsubscribe()
  const [pendingRepoId, setPendingRepoId] = useState<string | null>(null)
  const [unsubscribeId, setUnsubscribeId] = useState<string | null>(null)
  const isLoggedIn = useAuthStore((s) => s.isAuthenticated)
  const domainRouted = useMemo(() => isDomainEntityRouting(), [])

  // Store "all repositories" as the last location (authenticated users only)
  useEffect(() => {
    if (isLoggedIn) setLastRepo(null)
  }, [isLoggedIn])

  const sortedRepositories = useMemo(
    () => [...(repositories ?? [])].sort((a, b) => naturalCompare(a.name, b.name)),
    [repositories]
  )
  const hasRepos = sortedRepositories.length > 0

  // Set of subscribed repository IDs for inline search
  const subscribedRepoIds = useMemo(
    () => new Set(sortedRepositories.flatMap((r) => [r.id, r.fingerprint].filter((x): x is string => !!x))),
    [sortedRepositories]
  )

  // Recommendations query (only for logged-in users)
  const {
    data: recommendationsData,
    isError: isRecommendationsError,
  } = useQuery({
    queryKey: ['repositories', 'recommendations'],
    queryFn: () => reposRequest.get<RecommendationsResponse>(endpoints.repo.recommendations, { baseURL: appBasePath() }),
    retry: false,
    refetchOnWindowFocus: false,
    enabled: isLoggedIn,
  })
  const recommendations = recommendationsData?.repositories ?? []

  const handleSubscribeRecommendation = async (repo: RecommendedRepository) => {
    setPendingRepoId(repo.id)
    try {
      await toastAction(
        callWithServerFallback(
          (server) =>
            subscribe.mutateAsync({
              repository: repo.id,
              server,
            }),
          repo.server || undefined,
        ),
        {
          loading: t`Subscribing...`,
          success: t`Subscribed`,
          error: (e) => getErrorMessage(e, t`Failed to subscribe`),
        }
      )
      await queryClient.invalidateQueries({ queryKey: ['repositories', 'recommendations'] })
      await router.invalidate()
    } catch {
      // toast already shown
    } finally {
      setPendingRepoId(null)
    }
  }

  const refreshRepos = () => {
    void router.invalidate()
  }

  // In domain-routed context, use /<path>; otherwise use fingerprint.
  // Both resolve through the $repoId route via its info loader.
  const repoParam = (repo: Repository): string => {
    if (domainRouted && repo.path) return repo.path
    return repo.fingerprint ?? repo.id
  }

  return (
    <>
      <PageHeader
        title={t`Repositories`}
        icon={<FolderGit2 className="size-4 md:size-5" />}
      />
      <Main>
        <div className="container mx-auto p-6">
          {!hasRepos ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <FolderGit2 className="text-muted-foreground mx-auto mb-3 h-10 w-10 opacity-50" />
              <p className="text-muted-foreground mb-1 text-sm font-medium"><Trans>Repositories</Trans></p>
            <p className="text-muted-foreground mb-4 max-w-sm text-xs">
              {isLoggedIn ? t`You have no repositories yet.` : t`No public repositories.`}
            </p>
            {isLoggedIn && (
              <>
                <InlineRepoSearch subscribedIds={subscribedRepoIds} onRefresh={refreshRepos} />
                <Button variant="outline" onClick={openCreateDialog} className="mt-4">
                  <Plus className="me-2 h-4 w-4" />
                  <Trans>Create a new repository</Trans>
                </Button>
              </>
            )}

            {/* Recommendations Section (logged-in only) */}
            {isLoggedIn && !isRecommendationsError && recommendations.filter((rec) => !subscribedRepoIds.has(rec.id)).length > 0 && (
              <>
                <hr className="my-6 w-full max-w-md border-t" />
                <div className="w-full max-w-md">
                  <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wide">
                    <Trans>Recommended repositories</Trans>
                  </p>
                  <div className="divide-border divide-y rounded-lg border text-start">
                    {recommendations
                      .filter((rec) => !subscribedRepoIds.has(rec.id))
                      .map((rec) => {
                        const isPending = pendingRepoId === rec.id

                        return (
                          <div
                            key={rec.id}
                            className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-hover"
                          >
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                                <FolderGit2 className="h-4 w-4 text-primary" />
                              </div>
                              <div className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate text-sm font-medium">{rec.name}</span>
                                {rec.blurb && (
                                  <span className="text-muted-foreground truncate text-xs">
                                    {rec.blurb}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleSubscribeRecommendation(rec)}
                              disabled={isPending}
                            >
                              {isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trans>Subscribe</Trans>
                              )}
                            </Button>
                          </div>
                        )
                      })}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="divide-y rounded-lg border">
            {sortedRepositories.map((repo) => (
              <Link
                key={repo.id}
                to="/$repoId"
                params={{ repoId: repoParam(repo) }}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-hover"
              >
                <FolderGit2 className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{repo.name}</div>
                  {repo.description && (
                    <div className="text-sm text-muted-foreground truncate">{repo.description}</div>
                  )}
                </div>
                {isLoggedIn && repo.owner === 0 && (
                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={t`More actions`}
                            className="hover:bg-hover shrink-0 rounded-md p-1 transition-colors"
                            onClick={(e) => e.preventDefault()}
                          >
                            <MoreHorizontal className="text-muted-foreground size-4" />
                          </button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent>{t`More actions`}</TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.preventDefault()
                          setUnsubscribeId(repo.id)
                        }}
                      >
                        <Trans>Unsubscribe</Trans>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {repo.owner === 0 && repo.server && repo.server.startsWith('http') && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new URL(repo.server).hostname}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
        </div>
      </Main>

      <ConfirmDialog
        open={!!unsubscribeId}
        onOpenChange={(open) => { if (!open) setUnsubscribeId(null) }}
        title={t`Unsubscribe`}
        desc={t`Are you sure you want to unsubscribe from this repository?`}
        confirmText={t`Unsubscribe`}
        destructive
        isLoading={unsubscribe.isPending}
        handleConfirm={async () => {
          if (!unsubscribeId) return
          try {
            await toastAction(unsubscribe.mutateAsync(unsubscribeId), {
              loading: t`Unsubscribing...`,
              success: t`Unsubscribed`,
              error: (e) => getErrorMessage(e, t`Failed to unsubscribe`),
            })
            setUnsubscribeId(null)
            void router.invalidate()
          } catch {
            // toast already shown
          }
        }}
      />
    </>
  )
}
