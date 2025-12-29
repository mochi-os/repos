import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Header,
  Main,
  Card,
  CardContent,
  Badge,
  Skeleton,
  usePageTitle,
  requestHelpers,
  GeneralError,
} from '@mochi/common'
import { FolderGit2, GitBranch } from 'lucide-react'
import endpoints from '@/api/endpoints'
import type { InfoResponse } from '@/api/types'
import { useBranches } from '@/hooks/use-repository'

export const Route = createFileRoute('/_authenticated/branches')({
  loader: async () => {
    const info = await requestHelpers.get<InfoResponse>(endpoints.repo.info)
    return info
  },
  component: BranchesPage,
  errorComponent: ({ error }) => <GeneralError error={error} />,
})

function BranchesPage() {
  const data = Route.useLoaderData()

  usePageTitle(`Branches - ${data.name}`)

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
          <span>Branches</span>
        </div>
      </Header>
      <Main>
        <BranchesList repoId={data.id} />
      </Main>
    </>
  )
}

function BranchesList({ repoId }: { repoId: string }) {
  const { data, isLoading, error } = useBranches(repoId)

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
        {error instanceof Error ? error.message : 'Failed to load branches'}
      </div>
    )
  }

  const branches = data?.branches || []
  const defaultBranch = data?.default

  if (branches.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No branches yet</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <Card>
        <CardContent className="p-0 divide-y">
          {branches.map((branch) => (
            <Link
              key={branch.name}
              to={`/tree/${branch.name}` as any}
              className="flex items-center gap-4 p-4 hover:bg-accent transition-colors"
            >
              <GitBranch className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{branch.name}</span>
                  {branch.name === defaultBranch && (
                    <Badge variant="secondary">default</Badge>
                  )}
                </div>
              </div>
              <code className="text-sm text-muted-foreground font-mono flex-shrink-0">
                {branch.sha.substring(0, 7)}
              </code>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
