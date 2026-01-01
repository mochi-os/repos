import { createFileRoute } from '@tanstack/react-router'
import {
  Main,
  usePageTitle,
  requestHelpers,
  GeneralError,
} from '@mochi/common'
import endpoints from '@/api/endpoints'
import type { InfoResponse } from '@/api/types'
import { RepositoryNav } from '@/features/repository/repository-nav'
import { FileTree } from '@/features/repository/file-browser'

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
        <RepositoryNav
          fingerprint={fingerprint}
          name={data.name || 'Repository'}
          description={data.description}
          activeTab="files"
          isOwner={data.isAdmin}
        />
        <FileTree
          repoId={data.id}
          fingerprint={fingerprint}
          name={data.name || 'Repository'}
          defaultBranch={data.default_branch || 'main'}
          currentRef={ref}
          currentPath={path || ''}
        />
      </div>
    </Main>
  )
}
