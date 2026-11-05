// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import type { ReactNode } from 'react'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FileHistory, historyCut } from './file-history'

const hooks = vi.hoisted(() => ({ useHistory: vi.fn(), HISTORY_PAGE: 50 }))

vi.mock('@/hooks/use-repository', () => hooks)
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}))

beforeEach(() => {
  i18n.loadAndActivate({ locale: 'en', messages: {} })
  hooks.useHistory.mockReset()
})

afterEach(cleanup)

function show(data: { commits: unknown[]; partial?: boolean }) {
  hooks.useHistory.mockReturnValue({
    data,
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  })
  return render(
    <I18nProvider i18n={i18n}>
      <FileHistory repoId='repo' fingerprint='fp' gitRef='main' path='a.txt' />
    </I18nProvider>
  )
}

describe('FileHistory', () => {
  it('does not say no commit changed a file when the search stopped short', () => {
    show({ commits: [], partial: true })
    expect(screen.queryByText('No commits changed this file')).toBeNull()
    expect(screen.getByText('Older history was not searched')).toBeTruthy()
  })

  it('says no commit changed a file whose whole history was searched', () => {
    show({ commits: [], partial: false })
    expect(screen.getByText('No commits changed this file')).toBeTruthy()
  })
})

describe('historyCut', () => {
  it('says the history goes on when the walk stopped short', () => {
    expect(historyCut(true, 3)).toBe(true)
  })

  it('says so when the list holds the most the server lists', () => {
    // A history of 1,000 commits or more, listed to the server's limit,
    // showed no sign of the commits past it.
    expect(historyCut(false, 1000)).toBe(true)
    expect(historyCut(undefined, 1000)).toBe(true)
  })

  it('says nothing of a whole history', () => {
    expect(historyCut(false, 999)).toBe(false)
    expect(historyCut(undefined, 0)).toBe(false)
  })
})
