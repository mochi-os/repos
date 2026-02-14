import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Header,
  Main,
  Button,
  usePageTitle,
  GeneralError,
} from '@mochi/common'
import { FolderGit2, ArrowLeft } from 'lucide-react'
import { reposRequest } from '@/api/request'
import endpoints from '@/api/endpoints'
import type { InfoResponse } from '@/api/types'
import { CommitDetails } from '@/features/repository/commit-details'

export const Route = createFileRoute('/_authenticated/commit/$sha')({
  loader: async () => {
    const info = await reposRequest.get<InfoResponse>(endpoints.repo.info)
    return info
  },
  component: CommitPage,
  errorComponent: ({ error }) => <GeneralError error={error} />,
})

function CommitPage() {
  const data = Route.useLoaderData()
  const { sha } = Route.useParams()

  usePageTitle(`Commit ${sha.substring(0, 7)} - ${data.name}`)

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
          <span className="text-muted-foreground">/</span>
          <span>Commit</span>
        </div>
      </Header>
      <Main>
        <div className="space-y-4 p-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/$repoId/commits" params={{ repoId: data.fingerprint || data.id }}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to commits
              </Link>
            </Button>
          </div>
          <CommitDetails repoId={data.id} fingerprint={data.fingerprint || data.id} sha={sha} />
        </div>
      </Main>
    </>
  )
}
