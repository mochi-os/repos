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
import { FileBrowser } from '@/features/repository/file-browser'

export const Route = createFileRoute('/_authenticated/tree/$ref/$')({
  loader: async () => {
    const info = await requestHelpers.get<InfoResponse>(endpoints.repo.info)
    return info
  },
  component: TreePage,
  errorComponent: ({ error }) => <GeneralError error={error} />,
})

function TreePage() {
  const data = Route.useLoaderData()
  const { ref, _splat: path } = Route.useParams()

  usePageTitle(`${path || data.name || 'Files'} - ${data.name}`)

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

  return (
    <>
      <Header>
        <div className="flex items-center gap-2">
          <FolderGit2 className="h-5 w-5" />
          <h1 className="text-lg font-semibold">{data.name}</h1>
        </div>
      </Header>
      <Main>
        <FileBrowser
          repoId={data.id}
          defaultBranch={data.default_branch || 'main'}
          description={data.description}
          initialRef={ref}
          initialPath={path || ''}
        />
      </Main>
    </>
  )
}
