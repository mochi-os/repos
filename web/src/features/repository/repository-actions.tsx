// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { CloneDialog } from '@/components/clone-dialog'
import { DownloadDropdown } from '@/components/download-dropdown'
import { RepositoryLinkButton } from '@/components/repository-link-button'
import { UnsubscribeButton } from './repository-tabs'

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
