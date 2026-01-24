import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useEffect } from 'react'
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Header,
  Main,
  usePageTitle,
  GeneralError,
} from '@mochi/common'
import { GitBranch, Plus, FolderGit2, Search, Globe } from 'lucide-react'
import { reposRequest } from '@/api/request'
import endpoints from '@/api/endpoints'
import type { InfoResponse, Repository } from '@/api/types'
import { RepositoryTabs, type RepositoryTabId } from '@/features/repository/repository-tabs'
import { getLastRepo, clearLastRepo, setLastRepo } from '@/hooks/use-repos-storage'
import { useSidebarContext } from '@/context/sidebar-context'

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
  const { openSearchDialog, openCreateDialog } = useSidebarContext()

  // Store "all repositories" as the last location
  useEffect(() => {
    setLastRepo(null)
  }, [])

  const hasRepos = repositories && repositories.length > 0

  return (
    <>
      <Header>
        <h1 className="text-lg font-semibold">Repositories</h1>
        <div className="flex-1" />
        <div className="flex gap-2">
          <Button variant="outline" onClick={openSearchDialog}>
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Find</span>
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Create</span>
          </Button>
        </div>
      </Header>
      <Main>
        <div className="container mx-auto p-6">
          {!hasRepos ? (
            <div className="p-8 text-center">
              <FolderGit2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-4">No repositories yet</h2>
              <div className="flex justify-center gap-2">
                <Button variant="outline" onClick={openSearchDialog}>
                  <Search className="h-4 w-4 mr-2" />
                  Find repositories
                </Button>
                <Button onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create repository
                </Button>
              </div>
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
