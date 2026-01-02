import { createFileRoute } from '@tanstack/react-router'
import {
  Main,
  usePageTitle,
  GeneralError,
} from '@mochi/common'
import { reposRequest } from '@/api/request'
import type { InfoResponse } from '@/api/types'
import { RepositoryTabs, type RepositoryTabId } from '@/features/repository/repository-tabs'

const validTabs: RepositoryTabId[] = ['files', 'commits', 'branches', 'tags', 'settings', 'access']

type RepoSearch = {
  tab?: RepositoryTabId
}

export const Route = createFileRoute('/_authenticated/$repoId')({
  validateSearch: (search: Record<string, unknown>): RepoSearch => ({
    tab: validTabs.includes(search.tab as RepositoryTabId) ? (search.tab as RepositoryTabId) : undefined,
  }),
  loader: async ({ params, location }) => {
    console.log('[RepoIdLoader] Running with params:', params)
    const repoId = params.repoId
    if (!repoId) {
      throw new Error('Repository ID is required')
    }
    // Determine if we're in entity context (URL starts with entity ID) or app context
    const firstSegment = location.pathname.match(/^\/([^/]+)/)?.[1] || ''
    const isEntityContext = /^[1-9A-HJ-NP-Za-km-z]{9}$/.test(firstSegment)
    // In entity context, don't prepend app path; in app context, include app path
    const baseURL = isEntityContext
      ? `/${repoId}/-/`
      : `/${firstSegment}/${repoId}/-/`
    console.log('[RepoIdLoader] baseURL:', baseURL)
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

  usePageTitle(data.name || 'Repository')

  return (
    <Main>
      <RepositoryTabs
        key={data.repoId}
        repoId={data.id || data.repoId}
        fingerprint={data.repoId}
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
