import { createFileRoute } from '@tanstack/react-router'
import {
  Main,
  usePageTitle,
  GeneralError,
} from '@mochi/common'
import { reposRequest } from '@/api/request'
import type { InfoResponse } from '@/api/types'
import { RepositoryNav } from '@/features/repository/repository-nav'
import { BlobViewer } from '@/features/repository/blob-viewer'

export const Route = createFileRoute('/_authenticated/$repoId_/blob/$ref/$')({
  loader: async ({ params }) => {
    const info = await reposRequest.get<InfoResponse>(
      'info',
      { baseURL: `/${params.repoId}/-/` }
    )
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
        <RepositoryNav
          fingerprint={data.repoId}
          name={data.name || 'Repository'}
          description={data.description}
          activeTab="files"
          isOwner={data.isAdmin}
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
