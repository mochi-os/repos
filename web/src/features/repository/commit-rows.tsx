// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { Link } from '@tanstack/react-router'
import { Card, CardContent, EntityAvatar, useFormat } from '@mochi/web'
import { GitCommit } from 'lucide-react'
import type { Commit } from '@/api/types'
import { getCommitTitle } from '@/lib/format'
import { PickBox } from './commit-picker'

// A list of commits, each opening its commit page. path carries a file or
// folder through, so the commit page shows that one's changes. With a picker,
// each row can be picked for comparing.
export function CommitRows({
  commits,
  fingerprint,
  path,
  picker,
}: {
  commits: Commit[]
  fingerprint: string
  path?: string
  picker?: { picked: string[]; toggle: (sha: string) => void }
}) {
  const { formatTimestamp } = useFormat()
  return (
    <Card>
      <CardContent className='divide-y p-0'>
        {commits.map((commit) => (
          <div
            key={commit.sha}
            className='hover:bg-hover flex items-start gap-3 p-4 transition-colors'
          >
            {picker && (
              <PickBox
                sha={commit.sha}
                picked={picker.picked.includes(commit.sha)}
                onToggle={picker.toggle}
              />
            )}
            <Link
              to='/$repoId/commit/$sha'
              params={{ repoId: fingerprint, sha: commit.sha }}
              search={{ path }}
              className='flex min-w-0 flex-1 items-start gap-4'
            >
              <GitCommit className='text-muted-foreground mt-0.5 h-5 w-5 flex-shrink-0' />
              <div className='min-w-0 flex-1'>
                <div className='truncate font-medium'>
                  {getCommitTitle(commit.message)}
                </div>
                <div className='text-muted-foreground mt-1 flex items-center gap-2 text-sm'>
                  <EntityAvatar
                    seed={commit.email || commit.author}
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
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
