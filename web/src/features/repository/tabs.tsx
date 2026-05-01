import { useLingui } from '@lingui/react/macro'
import {
  FolderGit2,
  History,
  GitBranch,
  Tag,
  Settings,
  Shield,
} from 'lucide-react'

export type RepositoryTabId = 'files' | 'commits' | 'branches' | 'tags' | 'settings' | 'access'

export interface Tab {
  id: RepositoryTabId
  label: string
  icon: React.ReactNode
  to: string
  search?: Record<string, string>
  ownerOnly?: boolean
}

export function useRepositoryTabs(): Tab[] {
  const { t } = useLingui()
  return [
    { id: 'files', label: t`Files`, icon: <FolderGit2 className="h-4 w-4" />, to: '/$repoId' },
    { id: 'commits', label: t`Commits`, icon: <History className="h-4 w-4" />, to: '/$repoId/commits' },
    { id: 'branches', label: t`Branches`, icon: <GitBranch className="h-4 w-4" />, to: '/$repoId/branches' },
    { id: 'tags', label: t`Tags`, icon: <Tag className="h-4 w-4" />, to: '/$repoId/tags' },
    { id: 'access', label: t`Access`, icon: <Shield className="h-4 w-4" />, to: '/$repoId', search: { tab: 'access' }, ownerOnly: true },
    { id: 'settings', label: t`Settings`, icon: <Settings className="h-4 w-4" />, to: '/$repoId', search: { tab: 'settings' }, ownerOnly: true },
  ]
}
