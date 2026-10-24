// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import type { ReactNode } from 'react'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CommitSearch } from '@/lib/diff-options'
import { useCommitChanges } from './commit-changes'

const hooks = vi.hoisted(() => ({
  useCommit: vi.fn(),
  useDiff: vi.fn(),
  useDiffStyle: vi.fn(() => ['unified', () => {}]),
}))
vi.mock('@/hooks/use-repository', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/use-repository')>()),
  ...hooks,
}))
vi.mock('./repository-diff', () => ({
  DiffBar: ({ label }: { label: ReactNode }) => <div>{label}</div>,
  RepositoryDiff: ({ diff }: { diff: string }) => <pre>{diff}</pre>,
}))

const sha = 'a'.repeat(40)
const parent = 'b'.repeat(40)

function Page({
  search,
  onSearch,
}: {
  search: CommitSearch
  onSearch: (next: Partial<CommitSearch>) => void
}) {
  const { bar, body } = useCommitChanges({
    repoId: 'entity',
    fingerprint: 'fp',
    sha,
    search,
    onSearch,
  })
  return (
    <div>
      {bar}
      {body}
    </div>
  )
}

function show(search: CommitSearch = {}, onSearch = vi.fn()) {
  render(
    <I18nProvider i18n={i18n}>
      <Page search={search} onSearch={onSearch} />
    </I18nProvider>
  )
  return onSearch
}

const diff = (text: string) => ({
  data: { base: parent, head: sha, start: parent, diff: text, commits: [] },
  isLoading: false,
  error: null,
  refetch: vi.fn(),
})

describe('useCommitChanges', () => {
  beforeEach(() => {
    i18n.loadAndActivate({ locale: 'en', messages: {} })
  })
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('shows the diff while the commit is still on its way', () => {
    hooks.useCommit.mockReturnValue({ data: undefined })
    hooks.useDiff.mockReturnValue(diff('the changes'))
    show()
    // THE POINT: the diff does not wait for the commit to name its parent.
    expect(screen.getByText('the changes')).toBeTruthy()
    expect(hooks.useDiff).toHaveBeenCalledWith('entity', {
      base: '',
      head: sha,
      mode: 'direct',
      path: undefined,
    })
  })

  it('drops a parent the commit does not have', () => {
    hooks.useCommit.mockReturnValue({
      data: { commit: { sha, parents: [parent] } },
    })
    hooks.useDiff.mockReturnValue(diff('against a stranger'))
    const onSearch = show({ parent: 'c'.repeat(40) })
    expect(onSearch).toHaveBeenCalledWith({ parent: undefined })
    expect(screen.queryByText('against a stranger')).toBeNull()
  })

  it('keeps a parent the commit has', () => {
    hooks.useCommit.mockReturnValue({
      data: { commit: { sha, parents: ['c'.repeat(40), parent] } },
    })
    hooks.useDiff.mockReturnValue(diff('against the second'))
    const onSearch = show({ parent })
    expect(onSearch).not.toHaveBeenCalled()
    expect(screen.getByText('against the second')).toBeTruthy()
  })
})
