import { createFileRoute, Link } from '@tanstack/react-router'
import { formatGitDate } from '@/lib/format'
import {
  Main,
  Card,
  CardContent,
  Skeleton,
  usePageTitle,
  GeneralError,
  getErrorMessage,
} from '@mochi/common'
import { GitCommit, User } from 'lucide-react'
import { reposRequest } from '@/api/request'
import type { InfoResponse } from '@/api/types'
import { useCommits } from '@/hooks/use-repository'
import { RepositoryHeader } from '@/features/repository/repository-header'

export const Route = createFileRoute('/_authenticated/$repoId_/commits')({
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
  component: CommitsPage,
  errorComponent: ({ error }) => <GeneralError error={error} />,
})

function CommitsPage() {
  const data = Route.useLoaderData()

  usePageTitle(`${data.name} commits`)

  return (
    <Main>
      <div className="p-4 space-y-4">
        <RepositoryHeader
          fingerprint={data.fingerprint || data.repoId}
          repoId={data.id || data.repoId}
          name={data.name || 'Repository'}
          path={data.path || ''}
          description={data.description}
          activeTab="commits"
          isOwner={data.isAdmin}
          isRemote={data.remote}
          server={data.server}
        />
        <CommitsList repoId={data.repoId} />
      </div>
    </Main>
  )
}

function CommitsList({ repoId }: { repoId: string }) {
  const { data, isLoading, error } = useCommits(repoId)

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[...Array(10)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">
        {getErrorMessage(error, 'Failed to load commits')}
      </div>
    )
  }

  const commits = data?.commits || []

  if (commits.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <GitCommit className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No commits yet</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <Card>
        <CardContent className="p-0 divide-y">
          {commits.map((commit) => (
            <Link
              key={commit.sha}
              to="/$repoId/commit/$sha"
              params={{ repoId, sha: commit.sha }}
              className="flex items-start gap-4 p-4 hover:bg-accent transition-colors"
            >
              <GitCommit className="h-5 w-5 mt-0.5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{getCommitTitle(commit.message)}</div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <User className="h-3 w-3" />
                  <span>{commit.author}</span>
                  <span>·</span>
                  <span>{formatGitDate(commit.date)}</span>
                </div>
              </div>
              <code className="text-sm text-muted-foreground font-mono flex-shrink-0">
                {commit.sha.substring(0, 7)}
              </code>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function getCommitTitle(message: string): string {
  const firstLine = message.split('\n')[0]
  return firstLine.length > 72 ? firstLine.substring(0, 69) + '...' : firstLine
}

