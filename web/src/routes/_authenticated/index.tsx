import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Header,
  Main,
  usePageTitle,
  requestHelpers,
  getAppPath,
  GeneralError,
} from '@mochi/common'
import { GitBranch, Plus, FolderGit2 } from 'lucide-react'
import endpoints from '@/api/endpoints'
import type { InfoResponse, Repository } from '@/api/types'
import { FileBrowser } from '@/features/repository/file-browser'

export const Route = createFileRoute('/_authenticated/')({
  loader: async () => {
    const info = await requestHelpers.get<InfoResponse>(endpoints.repo.info)
    return info
  },
  component: IndexPage,
  errorComponent: ({ error }) => <GeneralError error={error} />,
})

function IndexPage() {
  const data = Route.useLoaderData()

  // If we're in entity context, show the repository file browser
  if (data.entity && data.id) {
    return <RepositoryHomePage data={data} />
  }

  // Class context - show repository list
  return <RepositoryListPage repositories={data.repositories} />
}

function RepositoryHomePage({ data }: { data: InfoResponse }) {
  usePageTitle(data.name || 'Repository')

  return (
    <>
      <Header>
        <div className="flex items-center gap-2">
          <FolderGit2 className="h-5 w-5" />
          <h1 className="text-lg font-semibold">{data.name}</h1>
        </div>
      </Header>
      <Main>
        <FileBrowser
          repoId={data.id!}
          defaultBranch={data.default_branch || 'main'}
          description={data.description}
        />
      </Main>
    </>
  )
}

interface RepositoryListPageProps {
  repositories?: Repository[]
}

function RepositoryListPage({ repositories }: RepositoryListPageProps) {
  usePageTitle('Repositories')

  const hasRepos = repositories && repositories.length > 0

  return (
    <>
      <Header>
        <div className="flex items-center justify-between w-full">
          <h1 className="text-lg font-semibold">Repositories</h1>
          <Button asChild size="sm">
            <Link to="/new">
              <Plus className="h-4 w-4 mr-1" />
              New
            </Link>
          </Button>
        </div>
      </Header>
      <Main>
        <div className="container mx-auto p-6">
          {!hasRepos ? (
            <Card className="p-8 text-center">
              <FolderGit2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">No repositories yet</h2>
              <p className="text-muted-foreground mb-4">
                Create your first repository to get started.
              </p>
              <Button asChild>
                <Link to="/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Repository
                </Link>
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {repositories.map((repo) => (
                <a
                  key={repo.id}
                  href={`${getAppPath()}/${repo.id}`}
                  className="block"
                >
                  <Card className="transition-colors hover:bg-accent h-full">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FolderGit2 className="h-5 w-5" />
                        {repo.name}
                      </CardTitle>
                      {repo.description && (
                        <CardDescription>{repo.description}</CardDescription>
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                        <span className="flex items-center gap-1">
                          <GitBranch className="h-4 w-4" />
                          {repo.default_branch}
                        </span>
                      </div>
                    </CardHeader>
                  </Card>
                </a>
              ))}
            </div>
          )}
        </div>
      </Main>
    </>
  )
}
