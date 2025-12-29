import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Header,
  Main,
  Card,
  CardContent,
  Skeleton,
  usePageTitle,
  requestHelpers,
  GeneralError,
} from '@mochi/common'
import { FolderGit2, GitCommit, User } from 'lucide-react'
import endpoints from '@/api/endpoints'
import type { InfoResponse } from '@/api/types'
import { useCommits } from '@/hooks/use-repository'

export const Route = createFileRoute('/_authenticated/commits')({
  loader: async () => {
    const info = await requestHelpers.get<InfoResponse>(endpoints.repo.info)
    return info
  },
  component: CommitsPage,
  errorComponent: ({ error }) => <GeneralError error={error} />,
})

function CommitsPage() {
  const data = Route.useLoaderData()

  usePageTitle(`Commits - ${data.name}`)

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
          <span>Commits</span>
        </div>
      </Header>
      <Main>
        <CommitsList repoId={data.id} />
      </Main>
    </>
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
        {error instanceof Error ? error.message : 'Failed to load commits'}
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
              to={`/commit/${commit.sha}` as any}
              className="flex items-start gap-4 p-4 hover:bg-accent transition-colors"
            >
              <GitCommit className="h-5 w-5 mt-0.5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{getCommitTitle(commit.message)}</div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <User className="h-3 w-3" />
                  <span>{commit.author}</span>
                  <span>·</span>
                  <span>{formatDate(commit.date)}</span>
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

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60))
      return diffMinutes <= 1 ? 'just now' : `${diffMinutes} minutes ago`
    }
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`
  }

  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`

  return date.toLocaleDateString()
}
