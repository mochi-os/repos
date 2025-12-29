import { FolderGit2, Plus } from 'lucide-react'
import { type SidebarData } from '@mochi/common'

export const sidebarData: SidebarData = {
  navGroups: [
    {
      title: 'Repositories',
      items: [
        {
          title: 'All repositories',
          url: '/',
          icon: FolderGit2,
        },
        {
          title: 'New repository',
          url: '/new',
          icon: Plus,
        },
      ],
    },
  ],
}
