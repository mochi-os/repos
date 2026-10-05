// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { Link } from '@tanstack/react-router'
import { Trans } from '@lingui/react/macro'
import { cn, CardDescription } from '@mochi/web'
import { FolderGit2, Globe } from 'lucide-react'
import { serverHost } from '@/lib/validation'
import { RepositoryActions } from './repository-actions'
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
  const host = serverHost(server)

  const tabs = useRepositoryTabs()
  const visibleTabs = tabs.filter((tab) => !tab.ownerOnly || isOwner)

  return (
    <div className='space-y-4'>
      {/* Header with name, description, and action buttons */}
      <div className='flex items-center justify-between gap-2'>
        <div className='flex min-w-0 items-center gap-2'>
          <FolderGit2 className='h-5 w-5 shrink-0' />
          <Link
            to='/$repoId'
            params={{ repoId: fingerprint }}
            className='truncate text-xl font-semibold hover:underline'
          >
            {name}
          </Link>
          {isRemote && (
            <span className='text-muted-foreground flex shrink-0 items-center gap-1 text-xs'>
              <Globe className='h-3 w-3' />
              <span className='sr-only sm:not-sr-only'>
                <Trans>Subscribed</Trans>
              </span>
            </span>
          )}
        </div>
        <RepositoryActions
          fingerprint={fingerprint}
          path={path}
          downloadRef={showDownload ? currentRef || 'HEAD' : undefined}
          isOwner={isOwner}
          subscription={isRemote ? { repoId, name } : undefined}
        />
      </div>

      {description && (
        <CardDescription className='text-base'>{description}</CardDescription>
      )}

      {isRemote && host && (
        <p className='text-muted-foreground text-sm'>
          <Trans>From: {serverHost(server)}</Trans>
        </p>
      )}

      {/* Tab bar */}
      <div className='flex gap-1 border-b'>
        {visibleTabs.map((tab) => (
          <Link
            key={tab.id}
            to={tab.to}
            params={{ repoId: fingerprint }}
            search={tab.search ?? {}}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors',
              '-mb-px border-b-2',
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground border-transparent'
            )}
          >
            {tab.icon}
            <span className='hidden sm:inline'>{tab.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
