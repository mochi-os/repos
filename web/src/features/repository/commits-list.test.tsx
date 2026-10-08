// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import type { ReactNode } from 'react'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CommitsList } from './commits-list'

const hooks = vi.hoisted(() => ({ useCommits: vi.fn() }))

vi.mock('@/hooks/use-repository', () => hooks)
vi.mock('@/components/download-dropdown', () => ({
  DownloadDropdown: () => null,
}))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}))
vi.mock('@mochi/web', async (importOriginal) => ({
  ...(await importOriginal()),
  useFormat: () => ({ formatTimestamp: () => '' }),
  EntityAvatar: () => null,
  LoadMoreTrigger: ({ hasMore }: { hasMore: boolean }) =>
    hasMore ? <div data-testid='load-more-trigger' /> : null,
}))

function show() {
  return render(
    <I18nProvider i18n={i18n}>
      <CommitsList
        repoId='repo'
        fingerprint='repo-fingerprint'
        currentRef='main'
      />
    </I18nProvider>
  )
}

beforeEach(() => {
  i18n.loadAndActivate({ locale: 'en', messages: {} })
  hooks.useCommits.mockReset()
})

afterEach(cleanup)

describe('commit pagination errors', () => {
  it('shows a later-page error and retry while retaining loaded commits', () => {
    hooks.useCommits.mockReturnValue({
      data: {
        pages: [
          [
            {
              sha: 'first-sha',
              message: 'First loaded commit',
              author: 'Ada',
              date: 1,
            },
          ],
        ],
      },
      isLoading: false,
      error: new Error('The next page is unavailable'),
      fetchNextPage: vi.fn(),
      hasNextPage: true,
      isFetchingNextPage: false,
      isFetchNextPageError: true,
    })

    show()
    expect(screen.getByText('First loaded commit')).toBeTruthy()
    expect(screen.getByText('The next page is unavailable')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
    expect(screen.queryByTestId('load-more-trigger')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(
      hooks.useCommits.mock.results[0].value.fetchNextPage
    ).toHaveBeenCalledTimes(1)
    expect(screen.getByText('First loaded commit')).toBeTruthy()
  })

  it('offers a retry when the first commit request fails', () => {
    hooks.useCommits.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('The commit history is unavailable'),
      refetch: vi.fn(),
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isFetchNextPageError: false,
    })

    show()

    expect(screen.getByText('The commit history is unavailable')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(
      hooks.useCommits.mock.results[0].value.refetch
    ).toHaveBeenCalledTimes(1)
  })
})
