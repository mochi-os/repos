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

export const tabs: Tab[] = [
  { id: 'files', label: "Files", icon: <FolderGit2 className="h-4 w-4" />, to: '/$repoId' },
  { id: 'commits', label: "Commits", icon: <History className="h-4 w-4" />, to: '/$repoId/commits' },
  { id: 'branches', label: "Branches", icon: <GitBranch className="h-4 w-4" />, to: '/$repoId/branches' },
  { id: 'tags', label: "Tags", icon: <Tag className="h-4 w-4" />, to: '/$repoId/tags' },
  { id: 'access', label: "Access", icon: <Shield className="h-4 w-4" />, to: '/$repoId', search: { tab: 'access' }, ownerOnly: true },
  { id: 'settings', label: "Settings", icon: <Settings className="h-4 w-4" />, to: '/$repoId', search: { tab: 'settings' }, ownerOnly: true },
]
