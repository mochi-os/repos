// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { useCallback, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { useLingui } from '@lingui/react/macro'
import {
  Card,
  CardContent,
  EmptyState,
  EntityAvatar,
  LoadMoreTrigger,
  Skeleton,
  getErrorMessage,
  useFormat,
} from '@mochi/web'
import { GitCommit } from 'lucide-react'
import { getCommitTitle } from '@/lib/format'
import { useCommits } from '@/hooks/use-repository'
import { DownloadDropdown } from '@/components/download-dropdown'

interface CommitsListProps {
  repoId: string
  fingerprint: string
  currentRef: string
}

// The history of one ref. Shared by the Commits tab and the /commits page so
// the two cannot drift apart.
export function CommitsList({
  repoId,
  fingerprint,
  currentRef,
}: CommitsListProps) {
  const { t } = useLingui()
  const { formatTimestamp } = useFormat()
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useCommits(repoId, currentRef)
  // Offset paging: a push between two page loads adds commits at the top and
  // pushes the rest down, so the next page can repeat commits already shown.
  // Keep the first of each sha.
  const commits = useMemo(() => {
    const seen = new Set<string>()
    return (data?.pages ?? []).flat().filter((commit) => {
      if (seen.has(commit.sha)) return false
      seen.add(commit.sha)
      return true
    })
  }, [data])
  const loadMore = useCallback(() => {
    void fetchNextPage()
  }, [fetchNextPage])

  if (isLoading) {
    return (
      <div className='space-y-2'>
        {[...Array(10)].map((_, i) => (
          <Skeleton key={i} className='h-16 w-full' />
        ))}
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className='text-destructive p-4'>
        {getErrorMessage(error, t`Failed to load commits`)}
      </div>
    )
  }

  if (commits.length === 0) {
    return <EmptyState icon={GitCommit} title={t`No commits yet`} />
  }

  return (
    <>
      <Card>
        <CardContent className='divide-y p-0'>
          {commits.map((commit) => (
            <div
              key={commit.sha}
              className='hover:bg-hover flex items-start gap-4 p-4 transition-colors'
            >
              <Link
                to='/$repoId/commit/$sha'
                params={{ repoId: fingerprint, sha: commit.sha }}
                className='flex min-w-0 flex-1 items-start gap-4'
              >
                <GitCommit className='text-muted-foreground mt-0.5 h-5 w-5 flex-shrink-0' />
                <div className='min-w-0 flex-1'>
                  <div className='truncate font-medium'>
                    {getCommitTitle(commit.message)}
                  </div>
                  <div className='text-muted-foreground mt-1 flex items-center gap-2 text-sm'>
                    <EntityAvatar
                      seed={commit.author_email || commit.author}
                      name={commit.author}
                      size='xs'
                    />
                    <span>{commit.author}</span>
                    <span>·</span>
                    <span>{formatTimestamp(commit.date)}</span>
                  </div>
                </div>
                <code className='text-muted-foreground flex-shrink-0 font-mono text-sm'>
                  {commit.sha.substring(0, 7)}
                </code>
              </Link>
              <DownloadDropdown gitRef={commit.sha} variant='icon' />
            </div>
          ))}
        </CardContent>
      </Card>
      {/* Stops after a failed page: the observer re-arms whenever loading
        ends, so leaving it live would retry the failing request in a loop. */}
      <LoadMoreTrigger
        onLoadMore={loadMore}
        hasMore={!!hasNextPage && !isFetchNextPageError}
        isLoading={isFetchingNextPage}
      />
    </>
  )
}
