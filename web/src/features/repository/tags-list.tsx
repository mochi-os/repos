// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  Button,
  Card,
  CardContent,
  EmptyState,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  getErrorMessage,
  useFormat,
  naturalCompare,
} from '@mochi/web'
import { Download, GitCompare, Tag } from 'lucide-react'
import type { Tag as TagData } from '@/api/types'
import { useTags } from '@/hooks/use-repository'
import { DownloadDropdown } from '@/components/download-dropdown'

interface TagsListProps {
  repoId: string
  fingerprint: string
}

const isVersion = (name: string) =>
  name.split('.').every((p) => /^\d+$/.test(p))

// Newest version first, then the other tags newest first.
function sortTags(tags: TagData[]) {
  return [...tags].sort((a, b) => {
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
}

// The tag list, newest version first. Shared by the Tags tab and the /tags
// page so the two cannot drift apart.
export function TagsList({ repoId, fingerprint }: TagsListProps) {
  const { t } = useLingui()
  const { data, isLoading, error } = useTags(repoId)
  const tags = useMemo(() => sortTags(data?.tags ?? []), [data?.tags])

  if (isLoading) {
    return (
      <div className='space-y-2'>
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className='h-12 w-full' />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className='text-destructive p-4'>
        {getErrorMessage(error, t`Failed to load tags`)}
      </div>
    )
  }

  if (tags.length === 0) {
    return <EmptyState icon={Tag} title={t`No tags yet`} />
  }

  return (
    <Card>
      <CardContent className='divide-y p-0'>
        {tags.map((tag, index) => (
          <TagRow
            key={tag.name}
            tag={tag}
            previous={tags[index + 1]?.name}
            fingerprint={fingerprint}
          />
        ))}
      </CardContent>
    </Card>
  )
}

interface TagRowProps {
  tag: TagData
  // The tag before this one, which the compare button measures against.
  previous?: string
  fingerprint: string
}

// The row's links and buttons, in the same order before and after it activates.
const controls = (row: HTMLElement) => [
  ...row.querySelectorAll<HTMLElement>('a[href], button'),
]

// A row's tooltips and download menu are Radix components, about half a
// millisecond a row to mount, and a repository that tags every build has
// thousands of rows: each row starts with plain buttons of the same look and
// labels, and mounts the real ones when the pointer or focus first reaches it.
const TagRow = memo(function TagRow({
  tag,
  previous,
  fingerprint,
}: TagRowProps) {
  const { t } = useLingui()
  const { formatTimestamp } = useFormat()
  const [active, setActive] = useState(false)
  // Whether the download menu opens as it mounts: the plain button was pressed
  // before the row activated.
  const [opening, setOpening] = useState(false)
  // The control that had focus, to give it back once its replacement mounts.
  const focused = useRef(-1)
  const row = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!active || focused.current < 0 || !row.current) return
    controls(row.current)[focused.current]?.focus()
    focused.current = -1
  }, [active])

  const activate = (control: HTMLElement | null, open = false) => {
    if (active) return
    focused.current =
      control && row.current ? controls(row.current).indexOf(control) : -1
    setOpening(open)
    setActive(true)
  }

  const message = !!tag.message && tag.message !== tag.name
  const lines = (message ? 1 : 0) + (tag.tagger && tag.date ? 1 : 0)

  const compare = previous && (
    <Button
      variant='ghost'
      size='icon'
      asChild
      aria-label={t`Compare with ${previous}`}
    >
      <Link
        to='/$repoId/compare/$'
        params={{ repoId: fingerprint, _splat: `${previous}...${tag.name}` }}
      >
        <GitCompare className='h-4 w-4' />
      </Link>
    </Button>
  )

  return (
    // Off-screen rows are laid out only as they near the view, sized ahead
    // from the lines each shows; they stay findable, copyable and in the
    // accessibility tree meanwhile.
    <div
      ref={row}
      className='hover:bg-hover flex items-center gap-4 p-4 transition-colors [content-visibility:auto]'
      style={{
        containIntrinsicHeight: `auto max(var(--control-height-md), ${1.5 + lines * 1.25}rem)`,
      }}
      // Not on a touch, whose contact fires this before the tap's click: the
      // compare link would be replaced under the finger and the tap lost.
      // Tooltips do not open for a touch anyway.
      onPointerEnter={(event) => {
        if (event.pointerType !== 'touch') activate(null)
      }}
      // Keyboard focus only: a tap focuses the link before its click, and
      // replacing the link then would lose the click.
      onFocus={(event) => {
        if (event.target.matches(':focus-visible')) activate(event.target)
      }}
    >
      <Link
        to='/$repoId/tree/$ref/$'
        params={{ repoId: fingerprint, ref: tag.name, _splat: '' }}
        className='flex min-w-0 flex-1 items-center gap-4'
      >
        <Tag className='text-muted-foreground h-5 w-5 flex-shrink-0' />
        <div className='min-w-0 flex-1'>
          <div className='font-medium'>{tag.name}</div>
          {message && (
            <div className='text-muted-foreground truncate text-sm'>
              {tag.message}
            </div>
          )}
          {tag.tagger && tag.date && (
            <div className='text-muted-foreground text-sm'>
              <Trans>
                {tag.tagger} tagged on {formatTimestamp(tag.date)}
              </Trans>
            </div>
          )}
        </div>
        <code className='text-muted-foreground flex-shrink-0 font-mono text-sm'>
          {tag.sha.substring(0, 7)}
        </code>
      </Link>
      {/* Against the tag before it: what this release changed. */}
      {compare &&
        (active ? (
          <Tooltip>
            <TooltipTrigger asChild>{compare}</TooltipTrigger>
            <TooltipContent>{t`Compare with ${previous}`}</TooltipContent>
          </Tooltip>
        ) : (
          compare
        ))}
      {active ? (
        <DownloadDropdown
          gitRef={tag.name}
          variant='icon'
          defaultOpen={opening}
        />
      ) : (
        <Button
          variant='ghost'
          size='icon'
          icon={<Download className='h-4 w-4' />}
          aria-label={t`Download`}
          // A tap, as the real trigger opens on one, or a press that no
          // pointer or focus came before, as a screen reader sends.
          onPointerDown={(event) => {
            if (event.button === 0) activate(event.currentTarget, true)
          }}
          onClick={(event) => activate(event.currentTarget, true)}
        />
      )}
    </div>
  )
})
