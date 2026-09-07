// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { Trans, useLingui } from '@lingui/react/macro'
import { Link } from '@tanstack/react-router'
import { Card, CardContent, EntityAvatar, Skeleton, getErrorMessage, useFormat } from '@mochi/web'
import { GitCommit } from 'lucide-react'
import { useCommits } from '@/hooks/use-repository'
import { DownloadDropdown } from '@/components/download-dropdown'
import { getCommitTitle } from '@/lib/format'

interface CommitsListProps {
  repoId: string
  fingerprint: string
  currentRef: string
}

// The history of one ref. Shared by the Commits tab and the /commits page so
// the two cannot drift apart.
export function CommitsList({ repoId, fingerprint, currentRef }: CommitsListProps) {
  const { t } = useLingui()
  const { formatTimestamp } = useFormat()
  const { data, isLoading, error } = useCommits(repoId, currentRef)
  const commits = data?.commits || []

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(10)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">
        {getErrorMessage(error, t`Failed to load commits`)}
      </div>
    )
  }

  if (commits.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <GitCommit className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p><Trans>No commits yet</Trans></p>
      </div>
    )
  }

  return (
    <Card>
      <CardContent className="p-0 divide-y">
        {commits.map((commit) => (
          <div
            key={commit.sha}
            className="flex items-start gap-4 p-4 hover:bg-hover transition-colors"
          >
            <Link
              to="/$repoId/commit/$sha"
              params={{ repoId: fingerprint, sha: commit.sha }}
              className="flex items-start gap-4 flex-1 min-w-0"
            >
              <GitCommit className="h-5 w-5 mt-0.5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{getCommitTitle(commit.message)}</div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <EntityAvatar
                    seed={commit.author_email || commit.author}
                    name={commit.author}
                    size="xs"
                  />
                  <span>{commit.author}</span>
                  <span>·</span>
                  <span>{formatTimestamp(commit.date)}</span>
                </div>
              </div>
              <code className="text-sm text-muted-foreground font-mono flex-shrink-0">
                {commit.sha.substring(0, 7)}
              </code>
            </Link>
            <DownloadDropdown gitRef={commit.sha} variant="icon" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
