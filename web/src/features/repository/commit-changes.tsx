// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import type { ReactNode } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  GeneralError,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '@mochi/web'
import {
  shortRef,
  type CommitSearch,
  type DiffOptions,
} from '@/lib/diff-options'
import { useCommit, useDiff, useDiffStyle } from '@/hooks/use-repository'
import { DiffBar, RepositoryDiff } from './repository-diff'

// The changes a commit made: the bar of controls, which the page places in
// its sticky header, and the diff. A merge commit has a parent per branch it
// joined; its changes are read against the first unless the reader picks
// another. A first commit has none and shows every file it added.
export function useCommitChanges({
  repoId,
  fingerprint,
  sha,
  search,
  onSearch,
}: {
  repoId: string
  fingerprint: string
  sha: string
  search: CommitSearch
  onSearch: (next: Partial<CommitSearch>) => void
}): { bar: ReactNode; body: ReactNode } {
  const { t } = useLingui()
  const [style, setStyle] = useDiffStyle()
  const commit = useCommit(repoId, sha).data?.commit
  const parents = commit?.parents ?? []
  const parent =
    search.parent && parents.includes(search.parent)
      ? search.parent
      : (parents[0] ?? '')
  const options: DiffOptions = {
    context: search.context,
    whitespace: search.whitespace,
  }
  const { data, isLoading, error, refetch } = useDiff(repoId, {
    base: parent,
    // Held back until the commit says which parent to compare with.
    head: commit ? sha : '',
    mode: 'direct',
    path: search.path,
  })

  const bar = commit ? (
    <DiffBar
      label={
        parent ? (
          <Trans>
            Changes from {shortRef(parent)} → {shortRef(sha)}
          </Trans>
        ) : (
          <Trans>Changes in {shortRef(sha)}</Trans>
        )
      }
      options={options}
      onOptions={(next) => onSearch(next)}
      style={style}
      onStyle={setStyle}
      path={search.path}
      onPath={(path) => onSearch({ path })}
    >
      {parents.length > 1 && (
        <Select
          value={parent}
          onValueChange={(value) => onSearch({ parent: value })}
        >
          <SelectTrigger size='sm' aria-label={t`Parent`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {parents.map((value) => (
              <SelectItem key={value} value={value}>
                <span className='font-mono'>{shortRef(value)}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </DiffBar>
  ) : null

  const body =
    !commit || isLoading ? (
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
    ) : null

  return { bar, body }
}
