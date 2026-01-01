import { createFileRoute } from '@tanstack/react-router'
import {
  Main,
  usePageTitle,
  GeneralError,
} from '@mochi/common'
import { reposRequest } from '@/api/request'
import type { InfoResponse } from '@/api/types'
import { RepositoryNav } from '@/features/repository/repository-nav'
import { FileTree } from '@/features/repository/file-browser'

export const Route = createFileRoute('/_authenticated/$repoId_/tree/$ref/$')({
  loader: async ({ params }) => {
    const info = await reposRequest.get<InfoResponse>(
      'info',
      { baseURL: `/${params.repoId}/-/` }
    )
    return { ...info, repoId: params.repoId }
  },
  component: TreePage,
  errorComponent: ({ error }) => <GeneralError error={error} />,
})

function TreePage() {
  const data = Route.useLoaderData()
  const { ref, _splat: path } = Route.useParams()

  usePageTitle(`${path || data.name || 'Files'} - ${data.name}`)

  return (
    <Main>
      <div className="p-4 space-y-4">
        <RepositoryNav
          fingerprint={data.repoId}
          name={data.name || 'Repository'}
          description={data.description}
          activeTab="files"
          isOwner={data.isAdmin}
        />
        <FileTree
          repoId={data.id || data.repoId}
          fingerprint={data.repoId}
          name={data.name || 'Repository'}
          defaultBranch={data.default_branch || 'main'}
          currentRef={ref}
          currentPath={path || ''}
        />
      </div>
    </Main>
  )
}
