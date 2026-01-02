import { createFileRoute } from '@tanstack/react-router'
import {
  Main,
  usePageTitle,
  requestHelpers,
  GeneralError,
} from '@mochi/common'
import endpoints from '@/api/endpoints'
import type { InfoResponse } from '@/api/types'
import { RepositoryHeader } from '@/features/repository/repository-header'
import { BlobViewer } from '@/features/repository/blob-viewer'

export const Route = createFileRoute('/_authenticated/blob/$ref/$')({
  loader: async () => {
    const info = await requestHelpers.get<InfoResponse>(endpoints.repo.info)
    return info
  },
  component: BlobPage,
  errorComponent: ({ error }) => <GeneralError error={error} />,
})

function BlobPage() {
  const data = Route.useLoaderData()
  const { ref, _splat: path } = Route.useParams()

  const fileName = path?.split('/').pop() || 'file'
  usePageTitle(`${fileName} - ${data.name}`)

  if (!data.entity || !data.id) {
    return (
      <Main>
        <div className="p-4 text-muted-foreground">
          This page requires a repository context.
        </div>
      </Main>
    )
  }

  const fingerprint = data.fingerprint || data.id

  return (
    <Main>
      <div className="p-4 space-y-4">
        <RepositoryHeader
          fingerprint={fingerprint}
          name={data.name || 'Repository'}
          description={data.description}
          activeTab="files"
          isOwner={data.isAdmin}
        />
        <BlobViewer
          repoId={data.id}
          fingerprint={fingerprint}
          name={data.name || 'Repository'}
          gitRef={ref}
          path={path || ''}
        />
      </div>
    </Main>
  )
}
