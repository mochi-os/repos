import { createFileRoute } from '@tanstack/react-router'
import {
  Main,
  usePageTitle,
  GeneralError,
} from '@mochi/common'
import { reposRequest } from '@/api/request'
import type { InfoResponse } from '@/api/types'
import { RepositoryHeader } from '@/features/repository/repository-header'
import { BlobViewer } from '@/features/repository/blob-viewer'

export const Route = createFileRoute('/_authenticated/$repoId_/blob/$ref/$')({
  loader: async ({ params }) => {
    // Use window.location.pathname since TanStack Router's location is relative to app mount
    const pathname = window.location.pathname
    const firstSegment = pathname.match(/^\/([^/]+)/)?.[1] || ''
    const isEntityContext = /^[1-9A-HJ-NP-Za-km-z]{9}$/.test(firstSegment)
    const baseURL = isEntityContext
      ? `/${params.repoId}/-/`
      : `/${firstSegment}/${params.repoId}/-/`
    const info = await reposRequest.get<InfoResponse>('info', { baseURL })
    return { ...info, repoId: params.repoId }
  },
  component: BlobPage,
  errorComponent: ({ error }) => <GeneralError error={error} />,
})

function BlobPage() {
  const data = Route.useLoaderData()
  const { ref, _splat: path } = Route.useParams()

  const fileName = path?.split('/').pop() || 'file'
  usePageTitle(`${fileName} - ${data.name}`)

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
        <BlobViewer
          repoId={data.id || data.repoId}
          fingerprint={data.repoId}
          gitRef={ref}
          path={path || ''}
          name={data.name || 'Repository'}
        />
      </div>
    </Main>
  )
}
