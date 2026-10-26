// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import type { ReactNode } from 'react'
import { plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  Button,
  EmptyState,
  GeneralError,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '@mochi/web'
import { ArrowLeftRight, ArrowRight, GitCompare } from 'lucide-react'
import type { DiffMode } from '@/api/types'
import {
  shortRef,
  type CompareSearch,
  type DiffOptions,
} from '@/lib/diff-options'
import {
  useBranches,
  useDiff,
  useDiffStyle,
  useTags,
} from '@/hooks/use-repository'
import { RefSelector } from '@/components/ref-selector'
import { CommitRows } from './commit-rows'
import { DiffBar, RepositoryDiff } from './repository-diff'

// Two branches, tags or commits compared: the pickers and diff controls, which
// the page places in its sticky header, and the commits and diff between them.
export function useCompare({
  repoId,
  fingerprint,
  base,
  head,
  search,
  onSearch,
  onRange,
}: {
  repoId: string
  fingerprint: string
  base: string
  head: string
  search: CompareSearch
  onSearch: (next: Partial<CompareSearch>) => void
  onRange: (base: string, head: string) => void
}): { bar: ReactNode; body: ReactNode } {
  const { t } = useLingui()
  const [style, setStyle] = useDiffStyle()
  const branches = useBranches(repoId).data?.branches ?? []
  const tags = useTags(repoId).data?.tags ?? []
  const mode: DiffMode = search.mode ?? 'diverged'
  const options: DiffOptions = {
    context: search.context,
    whitespace: search.whitespace,
  }
  const { data, isLoading, error, refetch } = useDiff(repoId, {
    base,
    head,
    mode,
    path: search.path,
    commits: true,
  })

  const bar = (
    <div className='space-y-2'>
      <div className='flex flex-wrap items-center gap-2'>
        <RefSelector
          branches={branches}
          tags={tags}
          value={base}
          onValueChange={(value) => onRange(value, head)}
          label={t`Compare from`}
        />
        <ArrowRight className='text-muted-foreground size-4 shrink-0 rtl:rotate-180' />
        <RefSelector
          branches={branches}
          tags={tags}
          value={head}
          onValueChange={(value) => onRange(base, value)}
          label={t`Compare to`}
        />
        <Button
          variant='ghost'
          size='icon'
          onClick={() => onRange(head, base)}
          disabled={!head}
          aria-label={t`Swap`}
        >
          <ArrowLeftRight className='size-4' />
        </Button>
        <Select
          value={mode}
          onValueChange={(value) =>
            onSearch({ mode: value === 'direct' ? 'direct' : undefined })
          }
        >
          <SelectTrigger className='w-auto' aria-label={t`Comparison`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='diverged'>{t`Since they diverged`}</SelectItem>
            <SelectItem value='direct'>{t`As they stand`}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {head && (
        <DiffBar
          label={
            <Trans>
              Changes from {shortRef(base)} → {shortRef(head)}
            </Trans>
          }
          options={options}
          onOptions={(next) => onSearch(next)}
          style={style}
          onStyle={setStyle}
          path={search.path}
          onPath={(path) => onSearch({ path })}
        />
      )}
    </div>
  )

  const body = !head ? (
    <EmptyState icon={GitCompare} title={t`Choose what to compare`} />
  ) : isLoading ? (
    <div className='space-y-2'>
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className='h-5 w-full' />
      ))}
    </div>
  ) : error ? (
    <GeneralError
      error={error}
      minimal
      mode='inline'
      reset={() => void refetch()}
    />
  ) : data ? (
    <div className='space-y-4'>
      {data.commits.length > 0 && (
        <div className='space-y-2'>
          <h2 className='text-sm font-medium'>
            {plural(data.commits.length, {
              one: '# commit',
              other: '# commits',
            })}
          </h2>
          <div className='max-h-80 overflow-y-auto rounded-lg'>
            <CommitRows commits={data.commits} fingerprint={fingerprint} />
          </div>
        </div>
      )}
      <RepositoryDiff
        key={`${data.start}:${data.head}:${search.path ?? ''}`}
        repoId={repoId}
        fingerprint={fingerprint}
        start={data.start}
        head={data.head}
        diff={data.diff}
        options={options}
        style={style}
      />
    </div>
  ) : null

  return { bar, body }
}
