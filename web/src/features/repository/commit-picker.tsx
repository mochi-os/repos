// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { Link } from '@tanstack/react-router'
import { Trans, useLingui } from '@lingui/react/macro'
import { Button, Checkbox } from '@mochi/web'
import { GitCompare } from 'lucide-react'
import { pickedRange, shortRef } from '@/lib/diff-options'

export function PickBox({
  sha,
  picked,
  onToggle,
}: {
  sha: string
  picked: boolean
  onToggle: (sha: string) => void
}) {
  const { t } = useLingui()
  return (
    <Checkbox
      checked={picked}
      onCheckedChange={() => onToggle(sha)}
      aria-label={t`Pick ${shortRef(sha)} to compare`}
      className='mt-1 shrink-0'
    />
  )
}

// Shown once two commits are picked: compares them, the older as the base, as
// they stand. path limits the comparison to the file a history was read for.
export function PickedBar({
  picked,
  commits,
  fingerprint,
  path,
  onClear,
}: {
  picked: string[]
  commits: { sha: string; date: number }[]
  fingerprint: string
  path?: string
  onClear: () => void
}) {
  const range = pickedRange(picked, commits)
  if (!range) return null
  return (
    <div className='flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2'>
      <span className='font-mono text-sm'>
        {shortRef(range.base)} → {shortRef(range.head)}
      </span>
      <div className='flex items-center gap-2'>
        <Button variant='ghost' size='sm' onClick={onClear}>
          <Trans>Clear</Trans>
        </Button>
        <Button size='sm' asChild>
          <Link
            to='/$repoId/compare/$'
            params={{
              repoId: fingerprint,
              _splat: `${range.base}...${range.head}`,
            }}
            search={{ mode: 'direct', path }}
          >
            <GitCompare className='size-4' />
            <Trans>Compare</Trans>
          </Link>
        </Button>
      </div>
    </div>
  )
}
