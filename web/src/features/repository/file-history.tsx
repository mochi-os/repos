// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Trans, useLingui } from '@lingui/react/macro'
import { Button, EmptyState, GeneralError, Skeleton } from '@mochi/web'
import { FileCode, History } from 'lucide-react'
import { usePicked } from '@/hooks/use-picked'
import { useHistory } from '@/hooks/use-repository'
import { PickedBar } from './commit-picker'
import { CommitRows } from './commit-rows'

// Commits shown at first, and how many more each Load more asks for. The
// server lists at most 1,000.
const HISTORY_PAGE = 100
const HISTORY_MAXIMUM = 1000

// The commits that changed one file or folder, newest first. Each opens the
// commit with its changes limited to this path; any two can be picked and
// compared, which shows how the file changed between them.
export function FileHistory({
  repoId,
  fingerprint,
  gitRef,
  path,
}: {
  repoId: string
  fingerprint: string
  gitRef: string
  path: string
}) {
  const { t } = useLingui()
  const [limit, setLimit] = useState(HISTORY_PAGE)
  const { data, isLoading, isFetching, error, refetch } = useHistory(
    repoId,
    gitRef,
    path,
    limit
  )
  const { picked, toggle, clear } = usePicked()
  // Newest first by date. The server walks the history, which after a merge
  // lists one side's commits before the other's whatever their dates.
  const commits = useMemo(
    () => [...(data?.commits ?? [])].sort((a, b) => b.date - a.date),
    [data]
  )

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <h2 className='flex min-w-0 items-center gap-2 font-mono text-sm'>
          <History className='text-muted-foreground size-4 shrink-0' />
          <span className='truncate'>{path}</span>
        </h2>
        <Button variant='outline' size='sm' asChild>
          <Link
            to='/$repoId/blob/$ref/$'
            params={{ repoId: fingerprint, ref: gitRef, _splat: path }}
          >
            <FileCode className='size-4' />
            <Trans>View file</Trans>
          </Link>
        </Button>
      </div>
      {isLoading ? (
        <div className='space-y-2'>
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className='h-16 w-full' />
          ))}
        </div>
      ) : error ? (
        <GeneralError
          error={error}
          minimal
          mode='inline'
          reset={() => void refetch()}
        />
      ) : commits.length === 0 ? (
        <EmptyState icon={History} title={t`No commits changed this file`} />
      ) : (
        <>
          <PickedBar
            picked={picked}
            commits={commits}
            fingerprint={fingerprint}
            path={path}
            onClear={clear}
          />
          <CommitRows
            commits={commits}
            fingerprint={fingerprint}
            path={path}
            picker={{ picked, toggle }}
          />
          {commits.length >= limit && limit < HISTORY_MAXIMUM && (
            <div className='flex justify-center'>
              <Button
                variant='outline'
                size='sm'
                onClick={() =>
                  setLimit(Math.min(limit + HISTORY_PAGE, HISTORY_MAXIMUM))
                }
                disabled={isFetching}
              >
                <Trans>Load more</Trans>
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
