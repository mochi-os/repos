import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Main,
  Card,
  CardContent,
  Skeleton,
  usePageTitle,
  GeneralError,
  getErrorMessage,
} from '@mochi/common'
import { Tag } from 'lucide-react'
import { reposRequest } from '@/api/request'
import type { InfoResponse } from '@/api/types'
import { useTags } from '@/hooks/use-repository'
import { RepositoryHeader } from '@/features/repository/repository-header'

export const Route = createFileRoute('/_authenticated/$repoId_/tags')({
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
  component: TagsPage,
  errorComponent: ({ error }) => <GeneralError error={error} />,
})

function TagsPage() {
  const data = Route.useLoaderData()

  usePageTitle(`${data.name} tags`)

  return (
    <Main>
      <div className="p-4 space-y-4">
        <RepositoryHeader
          fingerprint={data.fingerprint || data.repoId}
          repoId={data.id || data.repoId}
          name={data.name || 'Repository'}
          description={data.description}
          activeTab="tags"
          isOwner={data.isAdmin}
          isRemote={data.remote}
          server={data.server}
        />
        <TagsList repoId={data.repoId} />
      </div>
    </Main>
  )
}

function TagsList({ repoId }: { repoId: string }) {
  const { data, isLoading, error } = useTags(repoId)

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">
        {getErrorMessage(error, 'Failed to load tags')}
      </div>
    )
  }

  const tags = data?.tags || []

  if (tags.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No tags yet</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <Card>
        <CardContent className="p-0 divide-y">
          {tags.map((tag) => (
            <Link
              key={tag.name}
              to="/$repoId/tree/$ref/$"
              params={{ repoId, ref: tag.name, _splat: '' }}
              className="flex items-center gap-4 p-4 hover:bg-accent transition-colors"
            >
              <Tag className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium">{tag.name}</div>
                {tag.message && (
                  <div className="text-sm text-muted-foreground truncate">
                    {tag.message}
                  </div>
                )}
                {tag.tagger && tag.date && (
                  <div className="text-sm text-muted-foreground">
                    {tag.tagger} tagged on {formatDate(tag.date)}
                  </div>
                )}
              </div>
              <code className="text-sm text-muted-foreground font-mono flex-shrink-0">
                {tag.sha.substring(0, 7)}
              </code>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString()
}
