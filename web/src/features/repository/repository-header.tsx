// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

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
  toastAction,
  toast,
  shellClipboardWrite,
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@mochi/web'
import {
  Check,
  Copy,
  FolderGit2,
  Globe,
  Link as LinkIcon,
  UserMinus,
} from 'lucide-react'
import { useUnsubscribe } from '@/hooks/use-repository'
import { reposRequest, appBasePath } from '@/api/request'
import endpoints from '@/api/endpoints'
import { CloneDialog } from '@/components/clone-dialog'
import { DownloadDropdown } from '@/components/download-dropdown'
import { useRepositoryTabs, type RepositoryTabId } from './tabs'


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
  const [linkOpen, setLinkOpen] = useState(false)
  const [shareLink, setShareLink] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)

  const openLinkDialog = async () => {
    setShareLink('')
    setLinkCopied(false)
    setLinkOpen(true)
    try {
      const response = await reposRequest.post<{ data?: { link: string }; link?: string }>(
        endpoints.repo.share(fingerprint),
        {},
        { baseURL: appBasePath() }
      )
      setShareLink(response.data?.link ?? response.link ?? '')
    } catch (error) {
      setLinkOpen(false)
      toast.error(getErrorMessage(error, t`Failed to create link`))
    }
  }

  const copyShareLink = async () => {
    if (!shareLink) return
    const ok = await shellClipboardWrite(shareLink)
    if (ok) {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    }
  }

  const tabs = useRepositoryTabs()
  const visibleTabs = tabs.filter(tab => !tab.ownerOnly || isOwner)

  const handleUnsubscribe = async () => {
    try {
      await toastAction(unsubscribe.mutateAsync(repoId), {
        loading: t`Unsubscribing...`,
        success: t`Unsubscribed from repository`,
        error: (e) => getErrorMessage(e, t`Failed to unsubscribe`),
      })
      setShowUnsubscribeDialog(false)
      void navigate({ to: '/' })
    } catch {
      // toast already shown
    }
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
        {isOwner && (
          <Button variant="outline" size="sm" onClick={() => void openLinkDialog()}>
            <LinkIcon className="h-4 w-4" />
            <span className="hidden sm:inline"><Trans>Link</Trans></span>
          </Button>
        )}
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
                    <Trans>This will remove "{name}" from your repository list. You can subscribe again later.</Trans>
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
        <ResponsiveDialog open={linkOpen} onOpenChange={setLinkOpen}>
          <ResponsiveDialogContent>
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle><Trans>Repository link</Trans></ResponsiveDialogTitle>
            </ResponsiveDialogHeader>
            <div className="bg-muted flex items-center gap-2 rounded-md p-3 font-mono text-sm">
              <code className="flex-1 break-all">{shareLink || '…'}</code>
              <Button variant="ghost" size="sm" onClick={() => void copyShareLink()} disabled={!shareLink} className="shrink-0">
                {linkCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
            <ResponsiveDialogFooter>
              <Button variant="outline" onClick={() => setLinkOpen(false)}><Trans>Done</Trans></Button>
            </ResponsiveDialogFooter>
          </ResponsiveDialogContent>
        </ResponsiveDialog>
      </div>

      {description && (
        <CardDescription className="text-base">{description}</CardDescription>
      )}

      {isRemote && server && server.startsWith('http') && (
        <p className="text-sm text-muted-foreground">
          <Trans>From: {new URL(server).hostname}</Trans>
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

