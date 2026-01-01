import { createFileRoute } from '@tanstack/react-router'
import {
  Main,
  usePageTitle,
  GeneralError,
} from '@mochi/common'
import { reposRequest } from '@/api/request'
import type { InfoResponse } from '@/api/types'
import { RepositoryTabs } from '@/features/repository/repository-tabs'

export const Route = createFileRoute('/_authenticated/$repoId')({
  loader: async ({ params }) => {
    // Fetch repository info using entity-level endpoint
    const info = await reposRequest.get<InfoResponse>(
      'info',
      { baseURL: `/${params.repoId}/-/` }
    )
    return { ...info, repoId: params.repoId }
  },
  component: RepositoryPage,
  errorComponent: ({ error }) => <GeneralError error={error} />,
})

function RepositoryPage() {
  const data = Route.useLoaderData()

  usePageTitle(data.name || 'Repository')

  return (
    <Main>
      <RepositoryTabs
        repoId={data.id || data.repoId}
        fingerprint={data.repoId}
        name={data.name || 'Repository'}
        defaultBranch={data.default_branch || 'main'}
        description={data.description}
        isOwner={data.isAdmin}
      />
    </Main>
  )
}
