import { createFileRoute } from '@tanstack/react-router'
import {
  Header,
  Main,
  usePageTitle,
  requestHelpers,
  GeneralError,
} from '@mochi/common'
import { FolderGit2 } from 'lucide-react'
import endpoints from '@/api/endpoints'
import type { InfoResponse } from '@/api/types'
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
      <>
        <Header>
          <h1 className="text-lg font-semibold">Repository not found</h1>
        </Header>
        <Main>
          <div className="p-4 text-muted-foreground">
            This page requires a repository context.
          </div>
        </Main>
      </>
    )
  }

  if (!path) {
    return (
      <>
        <Header>
          <h1 className="text-lg font-semibold">File not found</h1>
        </Header>
        <Main>
          <div className="p-4 text-muted-foreground">
            No file path specified.
          </div>
        </Main>
      </>
    )
  }

  return (
    <>
      <Header>
        <div className="flex items-center gap-2">
          <FolderGit2 className="h-5 w-5" />
          <h1 className="text-lg font-semibold">{data.name}</h1>
        </div>
      </Header>
      <Main>
        <BlobViewer repoId={data.id} ref={ref} path={path} />
      </Main>
    </>
  )
}
