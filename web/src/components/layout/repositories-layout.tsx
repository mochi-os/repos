import { useCallback, useEffect, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { AuthenticatedLayout, type SidebarData, type NavItem } from '@mochi/common'
import { FolderGit2, Plus, Search } from 'lucide-react'
import { useRepoInfo, repoKeys } from '@/hooks/use-repository'
import { SidebarProvider, useSidebarContext } from '@/context/sidebar-context'
import { CreateRepositoryDialog } from '@/features/repository/create-repository-dialog'

function RepositoriesLayoutInner() {
  const { data, refetch } = useRepoInfo()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()

  const {
    createDialogOpen,
    openCreateDialog,
    closeCreateDialog,
  } = useSidebarContext()

  useEffect(() => {
    void refetch()
  }, [refetch])

  // Get repositories from data
  const repositories = useMemo(() => data?.repositories ?? [], [data?.repositories])

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

    // Bottom items
    const bottomItems: NavItem[] = [
      { title: 'Find repositories', icon: Search, url: '/find' },
      { title: 'Create repository', icon: Plus, onClick: openCreateDialog },
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
  }, [repositories, handleAllReposClick, openCreateDialog, location.pathname])

  return (
    <>
      <AuthenticatedLayout sidebarData={sidebarData} />

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
