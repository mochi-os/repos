import { useCallback, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { AuthenticatedLayout, SearchEntityDialog, type SidebarData, type NavItem } from '@mochi/common'
import { Bookmark, FolderGit2, Plus, Search } from 'lucide-react'
import { useRepoInfo, useSubscribe, useAddBookmark, repoKeys } from '@/hooks/use-repository'
import { SidebarProvider, useSidebarContext } from '@/context/sidebar-context'
import { reposRequest, appBasePath } from '@/api/request'
import endpoints from '@/api/endpoints'
import type { RecommendationsResponse } from '@/api/types'
import { CreateRepositoryDialog } from '@/features/repository/create-repository-dialog'

function RepositoriesLayoutInner() {
  const { data, refetch } = useRepoInfo()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const subscribe = useSubscribe()
  const addBookmark = useAddBookmark()

  const {
    searchDialogOpen,
    openSearchDialog,
    closeSearchDialog,
    createDialogOpen,
    openCreateDialog,
    closeCreateDialog,
  } = useSidebarContext()

  useEffect(() => {
    void refetch()
  }, [refetch])

  // Recommendations query
  const {
    data: recommendationsData,
    isLoading: isLoadingRecommendations,
    isError: isRecommendationsError,
  } = useQuery({
    queryKey: ['repositories', 'recommendations'],
    queryFn: () => reposRequest.get<RecommendationsResponse>(endpoints.repo.recommendations, { baseURL: appBasePath() }),
    retry: false,
    refetchOnWindowFocus: false,
  })
  const recommendations = recommendationsData?.repositories ?? []

  // Get repositories and bookmarks from data
  const repositories = useMemo(() => data?.repositories ?? [], [data?.repositories])
  const bookmarks = useMemo(() => data?.bookmarks ?? [], [data?.bookmarks])

  // Set of subscribed and bookmarked repository IDs for search dialog
  const subscribedRepoIds = useMemo(
    () => new Set([
      ...repositories.flatMap((r) => [r.id, r.fingerprint].filter((x): x is string => !!x)),
      ...bookmarks.flatMap((b: { id: string; fingerprint?: string }) => [b.id, b.fingerprint].filter((x): x is string => !!x)),
    ]),
    [repositories, bookmarks]
  )

  // Handle subscribe from search dialog
  const handleSubscribe = useCallback(async (repoId: string) => {
    await subscribe.mutateAsync({ repository: repoId })
    queryClient.invalidateQueries({ queryKey: repoKeys.info() })
    // Navigate to the repository to show its content
    void navigate({ to: '/$repoId', params: { repoId } })
  }, [subscribe, queryClient, navigate])

  // Handle bookmark from search dialog
  const handleBookmark = useCallback(async (repoId: string, server?: string) => {
    await addBookmark.mutateAsync({ target: repoId, server })
    // Navigate to the repository
    void navigate({ to: '/$repoId', params: { repoId } })
  }, [addBookmark, navigate])

  // Handle "All repositories" click - navigate and refresh the list
  const handleAllReposClick = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: repoKeys.info() })
    navigate({ to: '/' })
  }, [queryClient, navigate])

  const sidebarData: SidebarData = useMemo(() => {
    // Sort repositories alphabetically by name
    const sortedRepos = [...repositories].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    )

    // Build repository items - use fingerprint for shorter URLs
    const repoItems: NavItem[] = sortedRepos.map((repo) => ({
      title: repo.name,
      url: '/' + repo.fingerprint,
      icon: FolderGit2,
    }))

    const allReposItem: NavItem = {
      title: 'All repositories',
      onClick: handleAllReposClick,
      icon: FolderGit2,
      isActive: location.pathname === '/',
    }

    // Build bookmark items
    const bookmarkItems: NavItem[] = bookmarks.map((b: { id: string; name: string; fingerprint?: string }) => ({
      title: b.name,
      url: '/' + (b.fingerprint ?? b.id),
      icon: Bookmark,
    }))

    // Bottom items
    const bottomItems: NavItem[] = [
      { title: 'Find repositories', icon: Search, onClick: openSearchDialog },
      { title: 'Create repository', icon: Plus, onClick: openCreateDialog },
    ]

    const groups: SidebarData['navGroups'] = [
      {
        title: '',
        items: [allReposItem, ...repoItems],
      },
      ...(bookmarkItems.length > 0
        ? [
            {
              title: 'Bookmarks',
              items: bookmarkItems,
            },
          ]
        : []),
      {
        title: '',
        separator: true,
        items: bottomItems,
      },
    ]

    return { navGroups: groups }
  }, [repositories, bookmarks, handleAllReposClick, openSearchDialog, openCreateDialog, location.pathname])

  return (
    <>
      <AuthenticatedLayout sidebarData={sidebarData} />

      {/* Search Repositories Dialog */}
      <SearchEntityDialog
        open={searchDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeSearchDialog()
        }}
        onSubscribe={handleSubscribe}
        onBookmark={handleBookmark}
        subscribedIds={subscribedRepoIds}
        entityClass="repository"
        searchEndpoint="/repositories/search"
        icon={FolderGit2}
        iconClassName="bg-purple-500/10 text-purple-600"
        title="Find repositories"
        placeholder="Search by name, ID, fingerprint, or URL..."
        emptyMessage="No repositories found"
        recommendations={recommendations}
        isLoadingRecommendations={isLoadingRecommendations}
        isRecommendationsError={isRecommendationsError}
      />

      {/* Create Repository Dialog */}
      <CreateRepositoryDialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeCreateDialog()
        }}
        hideTrigger
      />
    </>
  )
}

export function RepositoriesLayout() {
  return (
    <SidebarProvider>
      <RepositoriesLayoutInner />
    </SidebarProvider>
  )
}
