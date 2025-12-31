import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Header,
  Main,
  usePageTitle,
  GeneralError,
} from '@mochi/common'
import { FolderGit2 } from 'lucide-react'
import { reposRequest } from '@/api/request'
import type { InfoResponse } from '@/api/types'
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

  if (!path) {
    return (
      <>
        <Header>
          <div className="flex items-center gap-2">
            <FolderGit2 className="h-5 w-5" />
            <Link to="/$repoId" params={{ repoId: data.repoId }} className="text-lg font-semibold hover:underline">
              {data.name}
            </Link>
          </div>
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
          <Link to="/$repoId" params={{ repoId: data.repoId }} className="text-lg font-semibold hover:underline">
            {data.name}
          </Link>
          <span className="text-muted-foreground">/</span>
          <span>{fileName}</span>
        </div>
      </Header>
      <Main>
        <BlobViewer
          repoId={data.id || data.repoId}
          fingerprint={data.repoId}
          ref={ref}
          path={path}
          name={data.name || 'Repository'}
        />
      </Main>
    </>
  )
}
