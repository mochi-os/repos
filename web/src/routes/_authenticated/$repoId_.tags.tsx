import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Header,
  Main,
  Card,
  CardContent,
  Skeleton,
  usePageTitle,
  GeneralError,
} from '@mochi/common'
import { FolderGit2, Tag } from 'lucide-react'
import { reposRequest } from '@/api/request'
import type { InfoResponse } from '@/api/types'
import { useTags } from '@/hooks/use-repository'

export const Route = createFileRoute('/_authenticated/$repoId_/tags')({
  loader: async ({ params }) => {
    const info = await reposRequest.get<InfoResponse>(
      'info',
      { baseURL: `/${params.repoId}/-/` }
    )
    return { ...info, repoId: params.repoId }
  },
  component: TagsPage,
  errorComponent: ({ error }) => <GeneralError error={error} />,
})

function TagsPage() {
  const data = Route.useLoaderData()

  usePageTitle(`Tags - ${data.name}`)

  return (
    <>
      <Header>
        <div className="flex items-center gap-2">
          <FolderGit2 className="h-5 w-5" />
          <Link to="/$repoId" params={{ repoId: data.repoId }} className="text-lg font-semibold hover:underline">
            {data.name}
          </Link>
          <span className="text-muted-foreground">/</span>
          <span>Tags</span>
        </div>
      </Header>
      <Main>
        <TagsList repoId={data.repoId} />
      </Main>
    </>
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
        {error instanceof Error ? error.message : 'Failed to load tags'}
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
              to={`/tree/${tag.name}` as any}
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
