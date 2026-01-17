import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import {
  Header,
  Main,
  usePageTitle,
  GeneralError,
} from '@mochi/common'
import { FolderGit2 } from 'lucide-react'
import { reposRequest } from '@/api/request'
import type { InfoResponse } from '@/api/types'
import { RepositoryTabs, CloneDialog, UnsubscribeButton, type RepositoryTabId } from '@/features/repository/repository-tabs'
import { setLastRepo } from '@/hooks/use-repos-storage'

const validTabs: RepositoryTabId[] = ['files', 'commits', 'branches', 'tags', 'settings', 'access']

type RepoSearch = {
  tab?: RepositoryTabId
}

export const Route = createFileRoute('/_authenticated/$repoId')({
  validateSearch: (search: Record<string, unknown>): RepoSearch => ({
    tab: validTabs.includes(search.tab as RepositoryTabId) ? (search.tab as RepositoryTabId) : undefined,
  }),
  loader: async ({ params }) => {
    const repoId = params.repoId
    if (!repoId) {
      throw new Error('Repository ID is required')
    }
    // Use window.location.pathname since TanStack Router's location is relative to app mount
    const pathname = window.location.pathname
    const firstSegment = pathname.match(/^\/([^/]+)/)?.[1] || ''
    const isEntityContext = /^[1-9A-HJ-NP-Za-km-z]{9}$/.test(firstSegment)
    // In entity context, don't prepend app path; in app context, include app path
    const baseURL = isEntityContext
      ? `/${repoId}/-/`
      : `/${firstSegment}/${repoId}/-/`
    const info = await reposRequest.get<InfoResponse>('info', { baseURL })
    return { ...info, repoId }
  },
  component: RepositoryPage,
  errorComponent: ({ error }) => <GeneralError error={error} />,
})

function RepositoryPage() {
  const data = Route.useLoaderData()
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()

  const setActiveTab = (newTab: RepositoryTabId) => {
    void navigate({ search: { tab: newTab }, replace: true })
  }

  const name = data.name || 'Repository'

  usePageTitle(name)

  // Store last visited repository for restoration on next entry
  useEffect(() => {
    setLastRepo(data.repoId)
  }, [data.repoId])

  return (
    <>
      <Header>
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderGit2 className="h-5 w-5" />
            <h1 className="text-lg font-semibold">{name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <CloneDialog repoName={name} fingerprint={data.repoId} />
            {data.remote && (
              <UnsubscribeButton repoId={data.id || data.repoId} repoName={name} />
            )}
          </div>
        </div>
      </Header>
      <Main>
        <RepositoryTabs
          key={data.repoId}
          repoId={data.id || data.repoId}
          fingerprint={data.repoId}
          name={name}
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
