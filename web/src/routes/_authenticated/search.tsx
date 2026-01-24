import { useState, useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Search, FolderGit2, Globe, Loader2 } from 'lucide-react'
import {
  Button,
  Input,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  usePageTitle,
  Header,
  Main,
  getErrorMessage,
  toast,
} from '@mochi/common'
import { useSearchRepos, useSubscribe } from '@/hooks/use-repository'
import type { SearchResult } from '@/api/types'

export const Route = createFileRoute('/_authenticated/search')({
  component: SearchPage,
})

function SearchPage() {
  usePageTitle('Find repositories')
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  // Auto-debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim())
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const { data: searchData, isLoading } = useSearchRepos(debouncedQuery)
  const subscribe = useSubscribe()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // Form submission not needed with auto-debounce, but kept for Enter key support
  }

  const handleSubscribe = (result: SearchResult) => {
    subscribe.mutate(
      { repository: result.id, server: result.server },
      {
        onSuccess: () => {
          toast.success(`Subscribed to ${result.name}`)
          // Navigate to the repository to show its content
          void navigate({ to: '/$repoId', params: { repoId: result.id } })
        },
        onError: (error) => {
          toast.error(getErrorMessage(error, 'Failed to subscribe'))
        },
      }
    )
  }

  const results = searchData?.results || []

  return (
    <>
      <Header>
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Find repositories</h1>
        </div>
      </Header>
      <Main>
        <div className="mx-auto max-w-2xl space-y-4 p-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Search
              </CardTitle>
              <CardDescription>
                Search by name, entity ID, fingerprint, or paste a repository URL
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch}>
                <div className="relative">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Repository name, ID, or URL..."
                    autoFocus
                  />
                  {isLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          {debouncedQuery && (
            <div className="space-y-2">
              {isLoading ? (
                <Card>
                  <CardContent className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </CardContent>
                </Card>
              ) : results.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No repositories found for "{debouncedQuery}"
                  </CardContent>
                </Card>
              ) : (
                results.map((result) => (
                  <SearchResultCard
                    key={result.id}
                    result={result}
                    onSubscribe={handleSubscribe}
                    isSubscribing={subscribe.isPending}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </Main>
    </>
  )
}

interface SearchResultCardProps {
  result: SearchResult
  onSubscribe: (result: SearchResult) => void
  isSubscribing: boolean
}

function SearchResultCard({ result, onSubscribe, isSubscribing }: SearchResultCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        <FolderGit2 className="h-8 w-8 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate">{result.name}</h3>
          {result.description && (
            <p className="text-sm text-muted-foreground truncate">{result.description}</p>
          )}
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground font-mono">{result.fingerprint}</p>
            {result.remote && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Globe className="h-3 w-3" />
                Remote
              </span>
            )}
          </div>
        </div>
        <Button
          onClick={() => onSubscribe(result)}
          disabled={isSubscribing}
          size="sm"
        >
          {isSubscribing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Subscribe'
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
