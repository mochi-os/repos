// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  Button,
  getErrorMessage,
  toast,
  shellClipboardWrite,
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@mochi/web'
import { Check, Copy, Link as LinkIcon } from 'lucide-react'
import { reposRequest, appBasePath } from '@/api/request'
import endpoints from '@/api/endpoints'

interface RepositoryLinkButtonProps {
  fingerprint: string
  isOwner?: boolean
}

// Owner-only mochi:// share-link button + dialog. Used by both repository
// headers ($repoId files view and the deep-link tab routes) so the share
// affordance is identical everywhere.
export function RepositoryLinkButton({ fingerprint, isOwner }: RepositoryLinkButtonProps) {
  const { t } = useLingui()
  const [linkOpen, setLinkOpen] = useState(false)
  const [shareLink, setShareLink] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)

  if (!isOwner) return null

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

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => void openLinkDialog()}>
        <LinkIcon className="h-4 w-4" />
        <span className="hidden sm:inline"><Trans>Link</Trans></span>
      </Button>
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
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  )
}
