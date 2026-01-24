import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Search, Loader2, FolderGit2 } from 'lucide-react'
import { Button, Input, toast } from '@mochi/common'
import { reposRequest, appBasePath } from '@/api/request'
import endpoints from '@/api/endpoints'
import type { SearchResult, SearchResponse } from '@/api/types'
import { repoKeys, useSubscribe } from '@/hooks/use-repository'

interface InlineRepoSearchProps {
  subscribedIds: Set<string>
  onRefresh?: () => void
}

export function InlineRepoSearch({ subscribedIds, onRefresh }: InlineRepoSearchProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [pendingRepoId, setPendingRepoId] = useState<string | null>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const subscribe = useSubscribe()

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.length === 0) {
      setResults([])
      return
    }

    const search = async () => {
      setIsLoading(true)
      try {
        const response = await reposRequest.get<SearchResponse>(
          `${endpoints.repo.search}?search=${encodeURIComponent(debouncedQuery)}`,
          { baseURL: appBasePath() }
        )
        setResults(response.results ?? [])
      } catch {
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }

    void search()
  }, [debouncedQuery])

  const handleSubscribe = async (repo: SearchResult) => {
    setPendingRepoId(repo.id)
    try {
      await subscribe.mutateAsync({ repository: repo.id })
      queryClient.invalidateQueries({ queryKey: repoKeys.info() })
      onRefresh?.()
      void navigate({ to: '/$repoId', params: { repoId: repo.id } })
    } catch (error) {
      toast.error('Failed to subscribe', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
      setPendingRepoId(null)
    }
  }

  const showResults = debouncedQuery.length > 0
  const showLoading = isLoading && debouncedQuery.length > 0

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Search Input */}
      <div className="relative mb-4">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder="Search for repositories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-10 pl-9"
          autoFocus
        />
      </div>

      {/* Results */}
      {showLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      )}

      {!isLoading && showResults && results.length === 0 && (
        <p className="text-muted-foreground text-sm text-center py-4">
          No repositories found
        </p>
      )}

      {!isLoading && results.length > 0 && (
        <div className="divide-border divide-y rounded-lg border">
          {results
            .filter((repo) => !subscribedIds.has(repo.id) && !subscribedIds.has(repo.fingerprint))
            .map((repo) => {
              const isPending = pendingRepoId === repo.id

              return (
                <div
                  key={repo.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-purple-500/10">
                      <FolderGit2 className="h-4 w-4 text-purple-600" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col text-left">
                      <span className="truncate text-sm font-medium">{repo.name}</span>
                      {repo.fingerprint && (
                        <span className="text-muted-foreground truncate text-xs">
                          {repo.fingerprint.match(/.{1,3}/g)?.join('-')}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleSubscribe(repo)}
                    disabled={isPending}
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Subscribe'
                    )}
                  </Button>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
