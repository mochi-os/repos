import { createFileRoute } from '@tanstack/react-router'
import {
  Main,
  usePageTitle,
  GeneralError,
} from '@mochi/common'
import { reposRequest } from '@/api/request'
import type { InfoResponse } from '@/api/types'
import { FileBrowser } from '@/features/repository/file-browser'

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
      <FileBrowser
        repoId={data.id || data.repoId}
        fingerprint={data.repoId}
        name={data.name || 'Repository'}
        defaultBranch={data.default_branch || 'main'}
        description={data.description}
        initialRef={ref}
        initialPath={path || ''}
      />
    </Main>
  )
}
