import { useCallback, useEffect, useMemo } from 'react'
import { useLingui } from '@lingui/react/macro'
import { useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { AuthenticatedLayout, useAuthStore, type SidebarData, type NavItem, naturalCompare} from '@mochi/web'
import { FolderGit2, Plus, Search } from 'lucide-react'
import { useRepoInfo, repoKeys } from '@/hooks/use-repository'
import { SidebarProvider, useSidebarContext } from '@/context/sidebar-context'
import { CreateRepositoryDialog } from '@/features/repository/create-repository-dialog'
import { isDomainRouted } from '@/api/request'

function RepositoriesLayoutInner() {
  const { t } = useLingui()
  const { data, refetch } = useRepoInfo()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const isLoggedIn = useAuthStore((s) => s.isAuthenticated)
  const domainRouted = useMemo(() => isDomainRouted(), [])

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
      naturalCompare(a.name, b.name)
    )

    // Build repository items - use path for domain-routed URLs, fingerprint otherwise
    const repoItems: NavItem[] = sortedRepos.map((repo) => ({
      title: repo.name,
      url: domainRouted && repo.path ? '/' + repo.path : '/' + repo.fingerprint,
      icon: FolderGit2,
    }))

    const allReposItem: NavItem = {
      title: t`All repositories`,
      onClick: handleAllReposClick,
      icon: FolderGit2,
      isActive: location.pathname === '/',
    }

    // Bottom items (logged-in only)
    const bottomItems: NavItem[] = isLoggedIn ? [
      { title: t`Find repositories`, icon: Search, url: '/find' },
      { title: t`Create repository`, icon: Plus, onClick: openCreateDialog },
    ] : []

    const groups: SidebarData['navGroups'] = [
      {
        title: '',
        items: [allReposItem, ...repoItems],
      },
    ]

    if (bottomItems.length > 0) {
      groups.push({
        title: '',
        separator: true,
        items: bottomItems,
      })
    }

    return { navGroups: groups }
  }, [repositories, handleAllReposClick, openCreateDialog, location.pathname, isLoggedIn, domainRouted])

  return (
    <>
      <AuthenticatedLayout sidebarData={sidebarData} />

      {/* Create Repository Dialog */}
      {isLoggedIn && (
        <CreateRepositoryDialog
          open={createDialogOpen}
          onOpenChange={(open) => {
            if (!open) closeCreateDialog()
          }}
          hideTrigger
        />
      )}
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
