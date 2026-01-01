import { useEffect, useMemo } from 'react'
import { AuthenticatedLayout } from '@mochi/common'
import type { SidebarData, NavItem } from '@mochi/common'
import { FolderGit2, Plus } from 'lucide-react'
import { useRepoInfo } from '@/hooks/use-repository'

export function RepositoriesLayout() {
  const { data, refetch } = useRepoInfo()

  useEffect(() => {
    void refetch()
  }, [refetch])

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

    // Build "All repositories" item
    const allReposItem: NavItem = {
      title: 'All repositories',
      url: '/',
      icon: FolderGit2,
    }

    // New repository item at the end
    const newRepoItem: NavItem = {
      title: 'New repository',
      url: '/new',
      icon: Plus,
    }

    const groups: SidebarData['navGroups'] = [
      {
        title: '',
        items: [allReposItem, ...repoItems, newRepoItem],
      },
    ]

    return { navGroups: groups }
  }, [data])

  return <AuthenticatedLayout sidebarData={sidebarData} />
}
