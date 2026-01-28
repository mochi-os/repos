import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Main,
  PageHeader,
  usePageTitle,
  GeneralError,
  toast,
} from '@mochi/common'
import { GitBranch, Plus, FolderGit2, Globe, Loader2 } from 'lucide-react'
import { reposRequest, appBasePath } from '@/api/request'
import endpoints from '@/api/endpoints'
import type { InfoResponse, Repository, RecommendationsResponse, RecommendedRepository } from '@/api/types'
import { RepositoryTabs, type RepositoryTabId } from '@/features/repository/repository-tabs'
import { getLastRepo, clearLastRepo, setLastRepo } from '@/hooks/use-repos-storage'
import { useSidebarContext } from '@/context/sidebar-context'
import { InlineRepoSearch } from '@/features/repository/inline-repo-search'
import { repoKeys, useSubscribe } from '@/hooks/use-repository'

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
    const info = await reposRequest.get<InfoResponse>(endpoints.repo.info)

    // Only redirect on first load, not on subsequent navigations
    if (hasCheckedRedirect) {
      return info
    }
    hasCheckedRedirect = true

    // In class context, check for last visited repository and redirect if it still exists
    if (!info.entity) {
      const lastRepoId = getLastRepo()
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
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()

  const setActiveTab = (newTab: RepositoryTabId) => {
    void navigate({ search: { tab: newTab }, replace: true })
  }

  usePageTitle(data.name || 'Repository')

  return (
    <Main>
      <RepositoryTabs
        repoId={data.id!}
        fingerprint={data.fingerprint || data.id!}
        name={data.name || 'Repository'}
        defaultBranch={data.default_branch || 'main'}
        description={data.description}
        isOwner={data.isAdmin}
        activeTab={tab ?? 'files'}
        onTabChange={setActiveTab}
      />
    </Main>
  )
}

interface RepositoryListPageProps {
  repositories?: Repository[]
}

function RepositoryListPage({ repositories }: RepositoryListPageProps) {
  usePageTitle('Repositories')
  const { openCreateDialog } = useSidebarContext()
  const queryClient = useQueryClient()
  const subscribe = useSubscribe()
  const [pendingRepoId, setPendingRepoId] = useState<string | null>(null)

  // Store "all repositories" as the last location
  useEffect(() => {
    setLastRepo(null)
  }, [])

  const hasRepos = repositories && repositories.length > 0

  // Set of subscribed repository IDs for inline search
  const subscribedRepoIds = useMemo(
    () => new Set((repositories ?? []).flatMap((r) => [r.id, r.fingerprint].filter((x): x is string => !!x))),
    [repositories]
  )

  // Recommendations query
  const {
    data: recommendationsData,
    isError: isRecommendationsError,
  } = useQuery({
    queryKey: ['repositories', 'recommendations'],
    queryFn: () => reposRequest.get<RecommendationsResponse>(endpoints.repo.recommendations, { baseURL: appBasePath() }),
    retry: false,
    refetchOnWindowFocus: false,
  })
  const recommendations = recommendationsData?.repositories ?? []

  const handleSubscribeRecommendation = async (repo: RecommendedRepository) => {
    setPendingRepoId(repo.id)
    try {
      await subscribe.mutateAsync({ repository: repo.id })
      queryClient.invalidateQueries({ queryKey: repoKeys.info() })
    } catch (error) {
      toast.error('Failed to subscribe', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
      setPendingRepoId(null)
    }
  }

  const refreshRepos = () => {
    queryClient.invalidateQueries({ queryKey: repoKeys.info() })
  }

  return (
    <>
      <PageHeader
        title="Repositories"
        icon={<FolderGit2 className="size-4 md:size-5" />}
      />
      <Main>
        <div className="container mx-auto p-6">
          {!hasRepos ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <FolderGit2 className="text-muted-foreground mx-auto mb-3 h-10 w-10 opacity-50" />
              <p className="text-muted-foreground mb-1 text-sm font-medium">Repositories</p>
            <p className="text-muted-foreground mb-4 max-w-sm text-xs">
              You have no repositories yet.
            </p>
            <InlineRepoSearch subscribedIds={subscribedRepoIds} onRefresh={refreshRepos} />
            <Button variant="outline" onClick={openCreateDialog} className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Create a new repository
            </Button>

            {/* Recommendations Section */}
            {!isRecommendationsError && recommendations.filter((rec) => !subscribedRepoIds.has(rec.id)).length > 0 && (
              <>
                <hr className="my-6 w-full max-w-md border-t" />
                <div className="w-full max-w-md">
                  <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wide">
                    Recommended repositories
                  </p>
                  <div className="divide-border divide-y rounded-lg border text-left">
                    {recommendations
                      .filter((rec) => !subscribedRepoIds.has(rec.id))
                      .map((rec) => {
                        const isPending = pendingRepoId === rec.id

                        return (
                          <div
                            key={rec.id}
                            className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                          >
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-purple-500/10">
                                <FolderGit2 className="h-4 w-4 text-purple-600" />
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
                                'Subscribe'
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {repositories.map((repo) => (
              <Link
                key={repo.id}
                to="/$repoId"
                params={{ repoId: repo.fingerprint }}
                className="block"
              >
                <Card className="transition-colors hover:bg-accent h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FolderGit2 className="h-5 w-5" />
                      {repo.name}
                      {repo.owner === 0 && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground font-normal">
                          <Globe className="h-3 w-3" />
                          Subscribed
                        </span>
                      )}
                    </CardTitle>
                    {repo.description && (
                      <CardDescription>{repo.description}</CardDescription>
                    )}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                      <span className="flex items-center gap-1">
                        <GitBranch className="h-4 w-4" />
                        {repo.default_branch}
                      </span>
                      {repo.owner === 0 && repo.server && repo.server.startsWith('http') && (
                        <span className="text-xs truncate max-w-[200px]">
                          {new URL(repo.server).hostname}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
        </div>
      </Main>
    </>
  )
}
