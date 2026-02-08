import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  cn,
  Button,
  CardDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  getErrorMessage,
  toast,
} from '@mochi/common'
import {
  FolderGit2,
  History,
  GitBranch,
  Tag,
  Settings,
  Shield,
  Globe,
  UserMinus,
} from 'lucide-react'
import { useUnsubscribe } from '@/hooks/use-repository'
import { CloneDialog } from '@/components/clone-dialog'

export type RepositoryTabId = 'files' | 'commits' | 'branches' | 'tags' | 'settings' | 'access'

interface Tab {
  id: RepositoryTabId
  label: string
  icon: React.ReactNode
  to: string
  search?: Record<string, string>
  ownerOnly?: boolean
}

const tabs: Tab[] = [
  { id: 'files', label: 'Files', icon: <FolderGit2 className="h-4 w-4" />, to: '/$repoId' },
  { id: 'commits', label: 'Commits', icon: <History className="h-4 w-4" />, to: '/$repoId/commits' },
  { id: 'branches', label: 'Branches', icon: <GitBranch className="h-4 w-4" />, to: '/$repoId/branches' },
  { id: 'tags', label: 'Tags', icon: <Tag className="h-4 w-4" />, to: '/$repoId/tags' },
  { id: 'access', label: 'Access', icon: <Shield className="h-4 w-4" />, to: '/$repoId', search: { tab: 'access' }, ownerOnly: true },
  { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" />, to: '/$repoId', search: { tab: 'settings' }, ownerOnly: true },
]

interface RepositoryHeaderProps {
  fingerprint: string
  repoId: string
  name: string
  description?: string
  activeTab: RepositoryTabId
  isOwner?: boolean
  isRemote?: boolean
  server?: string
}

export function RepositoryHeader({
  fingerprint,
  repoId,
  name,
  description,
  activeTab,
  isOwner,
  isRemote,
  server,
}: RepositoryHeaderProps) {
  const navigate = useNavigate()
  const unsubscribe = useUnsubscribe()
  const [showUnsubscribeDialog, setShowUnsubscribeDialog] = useState(false)

  const visibleTabs = tabs.filter(tab => !tab.ownerOnly || isOwner)

  const handleUnsubscribe = () => {
    unsubscribe.mutate(repoId, {
      onSuccess: () => {
        toast.success('Unsubscribed from repository')
        void navigate({ to: '/' })
      },
      onError: (error) => {
        toast.error(getErrorMessage(error, 'Failed to unsubscribe'))
      },
    })
    setShowUnsubscribeDialog(false)
  }

  return (
    <div className="space-y-4">
      {/* Header with name, description, and action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <FolderGit2 className="h-5 w-5" />
          <Link
            to="/$repoId"
            params={{ repoId: fingerprint }}
            className="text-xl font-semibold hover:underline"
          >
            {name}
          </Link>
          {isRemote && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Globe className="h-3 w-3" />
              Subscribed
            </span>
          )}
        </div>
        <div className="flex-1" />
        <CloneDialog repoName={name} fingerprint={fingerprint} />
        {isRemote && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowUnsubscribeDialog(true)}
              disabled={unsubscribe.isPending}
            >
              <UserMinus className="h-4 w-4" />
              <span className="hidden sm:inline">Unsubscribe</span>
            </Button>
            <AlertDialog open={showUnsubscribeDialog} onOpenChange={setShowUnsubscribeDialog}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Unsubscribe from repository?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove "{name}" from your repository list. You can subscribe again later.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleUnsubscribe}>Unsubscribe</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>

      {description && (
        <CardDescription className="text-base">{description}</CardDescription>
      )}

      {isRemote && server && server.startsWith('http') && (
        <p className="text-sm text-muted-foreground">
          From: {new URL(server).hostname}
        </p>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b">
        {visibleTabs.map((tab) => (
          <Link
            key={tab.id}
            to={tab.to}
            params={{ repoId: fingerprint }}
            search={tab.search ?? {}}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors',
              'border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

