import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Main,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Skeleton,
  usePageTitle,
  GeneralError,
} from '@mochi/common'
import { GitCommit, User, Calendar, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { reposRequest } from '@/api/request'
import type { InfoResponse } from '@/api/types'
import { useCommit } from '@/hooks/use-repository'
import { RepositoryHeader } from '@/features/repository/repository-header'

export const Route = createFileRoute('/_authenticated/$repoId_/commit/$sha')({
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
  component: CommitPage,
  errorComponent: ({ error }) => <GeneralError error={error} />,
})

function CommitPage() {
  const data = Route.useLoaderData()
  const { sha } = Route.useParams()

  usePageTitle(`Commit ${sha.substring(0, 7)} - ${data.name}`)

  return (
    <Main>
      <div className="p-4 space-y-4">
        <RepositoryHeader
          fingerprint={data.fingerprint || data.repoId}
          repoId={data.id || data.repoId}
          name={data.name || 'Repository'}
          description={data.description}
          activeTab="commits"
          isOwner={data.isAdmin}
          isRemote={data.remote}
          server={data.server}
        />
        <CommitDetails repoId={data.id || data.repoId} fingerprint={data.repoId} sha={sha} />
      </div>
    </Main>
  )
}

function CommitDetails({ repoId, fingerprint, sha }: { repoId: string; fingerprint: string; sha: string }) {
  const { data, isLoading, error } = useCommit(repoId, sha)
  const [copied, setCopied] = useState(false)

  const handleCopySha = () => {
    navigator.clipboard.writeText(sha)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">
        {error instanceof Error ? error.message : 'Failed to load commit'}
      </div>
    )
  }

  const commit = data?.commit
  if (!commit) {
    return (
      <div className="p-4 text-muted-foreground">Commit not found</div>
    )
  }

  const messageLines = commit.message.split('\n')
  const title = messageLines[0]
  const body = messageLines.slice(1).join('\n').trim()

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-xl">{title}</CardTitle>
              {body && (
                <pre className="mt-4 text-sm text-muted-foreground whitespace-pre-wrap font-sans">
                  {body}
                </pre>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{commit.author}</span>
              {commit.author_email && (
                <span className="text-muted-foreground">
                  &lt;{commit.author_email}&gt;
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{formatFullDate(commit.date)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4 p-2 bg-muted rounded-md">
            <GitCommit className="h-4 w-4 text-muted-foreground" />
            <code className="text-sm font-mono flex-1">{sha}</code>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopySha}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          {commit.parents && commit.parents.length > 0 && (
            <div className="mt-4 text-sm">
              <span className="text-muted-foreground">Parent{commit.parents.length > 1 ? 's' : ''}:</span>
              {commit.parents.map((parent) => (
                <Link
                  key={parent}
                  to="/$repoId/commit/$sha"
                  params={{ repoId: fingerprint, sha: parent }}
                  className="ml-2 font-mono text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {parent.substring(0, 7)}
                </Link>
              ))}
            </div>
          )}

          {commit.stats && (
            <div className="mt-4 flex items-center gap-4 text-sm">
              <span>{commit.stats.files} file{commit.stats.files !== 1 ? 's' : ''} changed</span>
              <span className="text-green-600">+{commit.stats.additions}</span>
              <span className="text-red-600">-{commit.stats.deletions}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {commit.diff && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Changes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <pre className="overflow-x-auto p-4 text-sm font-mono">
              {commit.diff.split('\n').map((line, index) => (
                <div
                  key={index}
                  className={
                    line.startsWith('+') && !line.startsWith('+++')
                      ? 'bg-green-500/10 text-green-600'
                      : line.startsWith('-') && !line.startsWith('---')
                        ? 'bg-red-500/10 text-red-600'
                        : line.startsWith('@@')
                          ? 'bg-blue-500/10 text-blue-600'
                          : ''
                  }
                >
                  {line}
                </div>
              ))}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function formatFullDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString()
}
