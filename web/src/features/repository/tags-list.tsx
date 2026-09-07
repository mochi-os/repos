// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { Trans, useLingui } from '@lingui/react/macro'
import { Link } from '@tanstack/react-router'
import { Card, CardContent, Skeleton, getErrorMessage, useFormat, naturalCompare } from '@mochi/web'
import { Tag } from 'lucide-react'
import { useTags } from '@/hooks/use-repository'
import { DownloadDropdown } from '@/components/download-dropdown'

interface TagsListProps {
  repoId: string
  fingerprint: string
}

const isVersion = (name: string) => name.split('.').every((p) => /^\d+$/.test(p))

// The tag list, newest version first. Shared by the Tags tab and the /tags
// page so the two cannot drift apart.
export function TagsList({ repoId, fingerprint }: TagsListProps) {
  const { t } = useLingui()
  const { formatTimestamp } = useFormat()
  const { data, isLoading, error } = useTags(repoId)

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">
        {getErrorMessage(error, t`Failed to load tags`)}
      </div>
    )
  }

  const tags = [...(data?.tags || [])].sort((a, b) => {
    const aVer = isVersion(a.name)
    const bVer = isVersion(b.name)
    // Version tags before non-version tags
    if (aVer !== bVer) return aVer ? -1 : 1
    // Both version tags: compare by version descending
    if (aVer) {
      const pa = a.name.split('.').map(Number)
      const pb = b.name.split('.').map(Number)
      for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const diff = (pb[i] ?? 0) - (pa[i] ?? 0)
        if (diff !== 0) return diff
      }
      return 0
    }
    // Both non-version: sort by date descending, then name descending
    if (a.date && b.date && a.date !== b.date) return b.date - a.date
    return naturalCompare(b.name, a.name)
  })

  if (tags.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p><Trans>No tags yet</Trans></p>
      </div>
    )
  }

  return (
    <Card>
      <CardContent className="p-0 divide-y">
        {tags.map((tag) => (
          <div
            key={tag.name}
            className="flex items-center gap-4 p-4 hover:bg-hover transition-colors"
          >
            <Link
              to="/$repoId/tree/$ref/$"
              params={{ repoId: fingerprint, ref: tag.name, _splat: '' }}
              className="flex items-center gap-4 flex-1 min-w-0"
            >
              <Tag className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium">{tag.name}</div>
                {tag.message && tag.message !== tag.name && (
                  <div className="text-sm text-muted-foreground truncate">
                    {tag.message}
                  </div>
                )}
                {tag.tagger && tag.date && (
                  <div className="text-sm text-muted-foreground">
                    <Trans>{tag.tagger} tagged on {formatTimestamp(tag.date)}</Trans>
                  </div>
                )}
              </div>
              <code className="text-sm text-muted-foreground font-mono flex-shrink-0">
                {tag.sha.substring(0, 7)}
              </code>
            </Link>
            <DownloadDropdown gitRef={tag.name} variant="icon" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
