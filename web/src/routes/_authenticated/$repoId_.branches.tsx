import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Header,
  Main,
  Card,
  CardContent,
  Badge,
  Skeleton,
  usePageTitle,
  GeneralError,
} from '@mochi/common'
import { FolderGit2, GitBranch } from 'lucide-react'
import { reposRequest } from '@/api/request'
import type { InfoResponse } from '@/api/types'
import { useBranches } from '@/hooks/use-repository'

export const Route = createFileRoute('/_authenticated/$repoId_/branches')({
  loader: async ({ params }) => {
    const info = await reposRequest.get<InfoResponse>(
      'info',
      { baseURL: `/${params.repoId}/-/` }
    )
    return { ...info, repoId: params.repoId }
  },
  component: BranchesPage,
  errorComponent: ({ error }) => <GeneralError error={error} />,
})

function BranchesPage() {
  const data = Route.useLoaderData()

  usePageTitle(`Branches - ${data.name}`)

  return (
    <>
      <Header>
        <div className="flex items-center gap-2">
          <FolderGit2 className="h-5 w-5" />
          <Link to="/$repoId" params={{ repoId: data.repoId }} className="text-lg font-semibold hover:underline">
            {data.name}
          </Link>
          <span className="text-muted-foreground">/</span>
          <span>Branches</span>
        </div>
      </Header>
      <Main>
        <BranchesList repoId={data.repoId} />
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
