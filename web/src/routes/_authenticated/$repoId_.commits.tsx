import { useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { createFileRoute, Link } from '@tanstack/react-router'
import { getCommitTitle } from '@/lib/format'
import {
  Main,
  Card,
  CardContent,
  EntityAvatar,
  Skeleton,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  usePageTitle,
  GeneralError,
  getErrorMessage,
  useFormat,
} from '@mochi/web'
import { GitBranch, GitCommit } from 'lucide-react'
import { reposRequest } from '@/api/request'
import type { InfoResponse } from '@/api/types'
import { useCommits, useBranches } from '@/hooks/use-repository'
import { RepositoryHeader } from '@/features/repository/repository-header'
import { DownloadDropdown } from '@/components/download-dropdown'

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
          showDownload={false}
        />
        <CommitsList
          repoId={data.repoId}
          defaultBranch={data.default_branch || 'main'}
        />
      </div>
    </Main>
  )
}

function CommitsList({ repoId, defaultBranch }: { repoId: string; defaultBranch: string }) {
  const { t } = useLingui()
  const { formatTimestamp } = useFormat()
  const [currentRef, setCurrentRef] = useState(defaultBranch)
  const { data: branchesData } = useBranches(repoId)
  const { data, isLoading, error } = useCommits(repoId, currentRef)

  const branches = branchesData?.branches || []

  return (
    <div className="space-y-4">
      {/* Branch selector */}
      {branches.length > 0 && (
        <Select value={currentRef} onValueChange={setCurrentRef}>
          <SelectTrigger className="w-[180px]">
            <GitBranch className="h-4 w-4 mr-2" />
            <SelectValue placeholder={"Select branch"} />
          </SelectTrigger>
          <SelectContent>
            {branches.map((branch) => (
              <SelectItem key={branch.name} value={branch.name}>
                {branch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(10)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="text-destructive">
          {getErrorMessage(error, t`Failed to load commits`)}
        </div>
      ) : (data?.commits || []).length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          <GitCommit className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p><Trans>No commits yet</Trans></p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {(data?.commits || []).map((commit) => (
              <div
                key={commit.sha}
                className="flex items-start gap-4 p-4 hover:bg-accent transition-colors"
              >
                <Link
                  to="/$repoId/commit/$sha"
                  params={{ repoId, sha: commit.sha }}
                  className="flex items-start gap-4 flex-1 min-w-0"
                >
                  <GitCommit className="h-5 w-5 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{getCommitTitle(commit.message)}</div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <EntityAvatar
                        seed={commit.author_email || commit.author}
                        name={commit.author}
                        size="xs"
                      />
                      <span>{commit.author}</span>
                      <span>·</span>
                      <span>{formatTimestamp(commit.date)}</span>
                    </div>
                  </div>
                  <code className="text-sm text-muted-foreground font-mono flex-shrink-0">
                    {commit.sha.substring(0, 7)}
                  </code>
                </Link>
                <DownloadDropdown gitRef={commit.sha} variant="icon" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}


