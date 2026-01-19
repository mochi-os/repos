import { useCallback, useEffect, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { AuthenticatedLayout, SearchEntityDialog } from '@mochi/common'
import type { SidebarData, NavItem } from '@mochi/common'
import { FolderGit2, Plus, Search } from 'lucide-react'
import { useRepoInfo, useSubscribe, repoKeys } from '@/hooks/use-repository'
import { SidebarProvider, useSidebarContext } from '@/context/sidebar-context'

function RepositoriesLayoutInner() {
  const { data, refetch } = useRepoInfo()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const subscribe = useSubscribe()

  const {
    searchDialogOpen,
    openSearchDialog,
    closeSearchDialog,
  } = useSidebarContext()

  useEffect(() => {
    void refetch()
  }, [refetch])

  // Set of subscribed repository IDs for search dialog
  const subscribedRepoIds = useMemo(
    () => new Set((data?.repositories ?? []).flatMap((r) => [r.id, r.fingerprint].filter((x): x is string => !!x))),
    [data?.repositories]
  )

  // Handle subscribe from search dialog
  const handleSubscribe = useCallback(async (repoId: string) => {
    await subscribe.mutateAsync({ repository: repoId })
    queryClient.invalidateQueries({ queryKey: repoKeys.info() })
    closeSearchDialog()
    navigate({ to: '/' })
  }, [subscribe, queryClient, closeSearchDialog, navigate])

  const sidebarData: SidebarData = useMemo(() => {
    const repositories = data?.repositories ?? []

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
      url: '/',
      icon: FolderGit2,
    }

    // Bottom items
    const bottomItems: NavItem[] = [
      { title: 'Search repositories', icon: Search, onClick: openSearchDialog },
      { title: 'New repository', url: '/new', icon: Plus },
    ]

    const groups: SidebarData['navGroups'] = [
      {
        title: '',
        items: [allReposItem, ...repoItems],
      },
      {
        title: '',
        separator: true,
        items: bottomItems,
      },
    ]

    return { navGroups: groups }
  }, [data, openSearchDialog])

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
        subscribedIds={subscribedRepoIds}
        entityClass="repository"
        searchEndpoint="/repositories/search"
        icon={FolderGit2}
        iconClassName="bg-purple-500/10 text-purple-600"
        title="Search repositories"
        description="Search for public repositories to subscribe to"
        placeholder="Search by name, ID, fingerprint, or URL..."
        emptyMessage="No repositories found"
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
