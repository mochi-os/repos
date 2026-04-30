import { useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
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
} from '@mochi/web'
import {
  FolderGit2,
  Globe,
  UserMinus,
} from 'lucide-react'
import { useUnsubscribe } from '@/hooks/use-repository'
import { CloneDialog } from '@/components/clone-dialog'
import { DownloadDropdown } from '@/components/download-dropdown'
import { tabs, type RepositoryTabId } from './tabs'


interface RepositoryHeaderProps {
  fingerprint: string
  repoId: string
  name: string
  path: string
  description?: string
  activeTab: RepositoryTabId
  isOwner?: boolean
  isRemote?: boolean
  server?: string
  currentRef?: string
  showDownload?: boolean
}

export function RepositoryHeader({
  fingerprint,
  repoId,
  name,
  path,
  description,
  activeTab,
  isOwner,
  isRemote,
  server,
  currentRef,
  showDownload = true,
}: RepositoryHeaderProps) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const unsubscribe = useUnsubscribe()
  const [showUnsubscribeDialog, setShowUnsubscribeDialog] = useState(false)

  const visibleTabs = tabs.filter(tab => !tab.ownerOnly || isOwner)

  const handleUnsubscribe = () => {
    unsubscribe.mutate(repoId, {
      onSuccess: () => {
        toast.success(t`Unsubscribed from repository`)
        void navigate({ to: '/' })
      },
      onError: (error) => {
        toast.error(getErrorMessage(error, t`Failed to unsubscribe`))
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
              <Trans>Subscribed</Trans>
            </span>
          )}
        </div>
        <div className="flex-1" />
        <CloneDialog repoPath={path} fingerprint={fingerprint} />
        {showDownload && (
          <DownloadDropdown gitRef={currentRef || 'HEAD'} />
        )}
        {isRemote && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowUnsubscribeDialog(true)}
              disabled={unsubscribe.isPending}
            >
              <UserMinus className="h-4 w-4" />
              <span className="hidden sm:inline"><Trans>Unsubscribe</Trans></span>
            </Button>
            <AlertDialog open={showUnsubscribeDialog} onOpenChange={setShowUnsubscribeDialog}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle><Trans>Unsubscribe from repository?</Trans></AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove "{name}" from your repository list. You can subscribe again later.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel><Trans>Cancel</Trans></AlertDialogCancel>
                  <AlertDialogAction onClick={handleUnsubscribe}><Trans>Unsubscribe</Trans></AlertDialogAction>
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

