// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Trans, useLingui } from '@lingui/react/macro'
import { Button, ConfirmDialog, getErrorMessage, toastAction } from '@mochi/web'
import { UserMinus } from 'lucide-react'
import { useUnsubscribe } from '@/hooks/use-repository'
import { CloneDialog } from '@/components/clone-dialog'
import { DownloadDropdown } from '@/components/download-dropdown'
import { RepositoryLinkButton } from '@/components/repository-link-button'

interface RepositoryActionsProps {
  fingerprint: string
  path: string
  /** The ref Download archives. Leave out where the page has nothing to download. */
  downloadRef?: string
  /** Owners get the share link button. */
  isOwner?: boolean
  /** Set for a subscribed repository, which is what offers Unsubscribe. */
  subscription?: { repoId: string; name: string }
}

// The buttons beside a repository's name, shared by every repository header so
// they stay in one order and one size. Below sm each button drops to its icon
// and keeps its name for screen readers: four worded buttons are wider than a
// phone, and they squeezed the name onto two lines or pushed off the screen.
export function RepositoryActions({
  fingerprint,
  path,
  downloadRef,
  isOwner,
  subscription,
}: RepositoryActionsProps) {
  return (
    <div className='flex shrink-0 items-center gap-2'>
      <CloneDialog repoPath={path} fingerprint={fingerprint} />
      {downloadRef && <DownloadDropdown gitRef={downloadRef} />}
      <RepositoryLinkButton fingerprint={fingerprint} isOwner={isOwner} />
      {subscription && (
        <UnsubscribeButton
          repoId={subscription.repoId}
          repoName={subscription.name}
        />
      )}
    </div>
  )
}

// Lives here rather than with the tab contents: the commit, branch and tag
// routes show these buttons too, and importing it from the tabs module made
// them load the file browser and settings code they never render.
function UnsubscribeButton({
  repoId,
  repoName,
}: {
  repoId: string
  repoName: string
}) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const unsubscribe = useUnsubscribe()
  const [showDialog, setShowDialog] = useState(false)
  const [isUnsubscribing, setIsUnsubscribing] = useState(false)

  const handleUnsubscribe = async () => {
    setIsUnsubscribing(true)
    try {
      await toastAction(unsubscribe.mutateAsync(repoId), {
        loading: t`Unsubscribing...`,
        success: t`Unsubscribed from repository`,
        error: (e) => getErrorMessage(e, t`Failed to unsubscribe`),
      })
      void navigate({ to: '/' })
    } catch {
      // toast already shown
    } finally {
      setIsUnsubscribing(false)
      setShowDialog(false)
    }
  }

  return (
    <>
      <Button
        variant='outline'
        size='sm'
        onClick={() => setShowDialog(true)}
        loading={isUnsubscribing}
        icon={<UserMinus className='h-4 w-4' />}
      >
        <span className='sr-only sm:not-sr-only'>
          <Trans>Unsubscribe</Trans>
        </span>
      </Button>
      <ConfirmDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        title={t`Unsubscribe from repository?`}
        desc={t`This will remove "${repoName}" from your repository list. You can subscribe again later.`}
        confirmText={t`Unsubscribe`}
        icon={<UserMinus className='size-4' />}
        destructive
        isLoading={isUnsubscribing}
        handleConfirm={handleUnsubscribe}
      />
    </>
  )
}
