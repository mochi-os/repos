import { createFileRoute } from '@tanstack/react-router'
import {
  Main,
  usePageTitle,
  GeneralError,
} from '@mochi/common'
import { reposRequest } from '@/api/request'
import type { InfoResponse } from '@/api/types'
import { RepositoryHeader } from '@/features/repository/repository-header'
import { FileTree } from '@/features/repository/file-browser'

export const Route = createFileRoute('/_authenticated/$repoId_/tree/$ref/$')({
  loader: async ({ params }) => {
    if (!params.repoId) {
      throw new Error('Repository ID is required')
    }
    // Use window.location.pathname since TanStack Router's location is relative to app mount
    const pathname = window.location.pathname
    const firstSegment = pathname.match(/^\/([^/]+)/)?.[1]
    if (!firstSegment) {
      throw new Error('Could not determine route context')
    }
    const isEntityContext = /^[1-9A-HJ-NP-Za-km-z]{9}$/.test(firstSegment)
    const baseURL = isEntityContext
      ? `/${params.repoId}/-/`
      : `/${firstSegment}/${params.repoId}/-/`
    const info = await reposRequest.get<InfoResponse>('info', { baseURL })
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
        <RepositoryHeader
          fingerprint={data.fingerprint || data.repoId}
          repoId={data.id || data.repoId}
          name={data.name || 'Repository'}
          description={data.description}
          activeTab="files"
          isOwner={data.isAdmin}
          isRemote={data.remote}
          server={data.server}
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
