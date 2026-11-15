// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CompareSearch } from '@/lib/diff-options'
import { commitsHeading, historiesTooLong, useCompare } from './compare-view'

const hooks = vi.hoisted(() => ({
  useBranches: () => ({ data: { branches: [] } }),
  useTags: () => ({ data: { tags: [] } }),
  useDiffStyle: () => ['inline', () => {}],
  useDiff: vi.fn(),
}))

vi.mock('@/hooks/use-repository', () => hooks)
vi.mock('@/components/ref-selector', () => ({ RefSelector: () => null }))
vi.mock('./commit-rows', () => ({ CommitRows: () => null }))
vi.mock('./repository-diff', () => ({
  DiffBar: () => null,
  RepositoryDiff: () => null,
}))

beforeEach(() => {
  i18n.loadAndActivate({ locale: 'en', messages: {} })
  hooks.useDiff.mockReset()
})

afterEach(cleanup)

// A refusal as the request client rejects it: the response's status and the
// body core answers, {"error": code, "message": text}.
function refusal(status: number, code: string, message: string) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, data: { error: code, message } },
  })
}

const tooLong = refusal(
  422,
  'histories_too_long',
  'The histories are too long to compare'
)

function Body(props: Parameters<typeof useCompare>[0]) {
  return <>{useCompare(props).body}</>
}

function show(error: unknown, search: CompareSearch = {}) {
  hooks.useDiff.mockReturnValue({
    data: undefined,
    isLoading: false,
    error,
    refetch: vi.fn(),
  })
  const onSearch = vi.fn()
  render(
    <I18nProvider i18n={i18n}>
      <Body
        repoId='repo'
        fingerprint='fp'
        base='main'
        head='topic'
        search={search}
        onSearch={onSearch}
        onRange={vi.fn()}
      />
    </I18nProvider>
  )
  return onSearch
}

describe('a comparison refused for histories too long to compare', () => {
  it('offers the direct comparison of the same two refs', () => {
    const onSearch = show(tooLong)
    expect(
      screen.getByText('The histories are too long to compare')
    ).toBeTruthy()
    fireEvent.click(
      screen.getByRole('button', { name: 'Compare as they stand' })
    )
    expect(onSearch).toHaveBeenCalledWith({ mode: 'direct' })
  })

  it('offers nothing more once the comparison is already direct', () => {
    show(tooLong, { mode: 'direct' })
    expect(
      screen.queryByRole('button', { name: 'Compare as they stand' })
    ).toBeNull()
  })

  it('leaves any other failure as it was, with its retry', () => {
    show(refusal(500, 'server_error', 'Server error: disk'))
    expect(
      screen.queryByRole('button', { name: 'Compare as they stand' })
    ).toBeNull()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  })
})

describe('historiesTooLong', () => {
  it("reads core's refusal code from the response", () => {
    expect(historiesTooLong(tooLong)).toBe(true)
  })

  it('is false for any other failure or none', () => {
    expect(historiesTooLong(refusal(422, 'invalid_ref', 'No such ref'))).toBe(
      false
    )
    expect(historiesTooLong(new Error('Network Error'))).toBe(false)
    expect(historiesTooLong(null)).toBe(false)
  })
})

describe("the heading over a comparison's commits", () => {
  it('counts a list shorter than a comparison lists', () => {
    expect(commitsHeading(Array(3).fill({}))).toBe('3 commits')
  })

  it("takes the server's word for whether the list was cut", () => {
    // Cut by the walk short of 1,000, and a whole range of exactly 1,000.
    expect(commitsHeading(Array(40).fill({}), true)).toBe(
      'The newest 40 commits'
    )
    expect(commitsHeading(Array(1000).fill({}), false)).toBe('1,000 commits')
  })

  it('says a list at the most a comparison lists is the newest of them', () => {
    // The comparison stops at 1,000 commits, so a list that long may have
    // left older ones out: it must not read as the whole range.
    expect(commitsHeading(Array(1000).fill({}))).toBe(
      'The newest 1,000 commits'
    )
  })
})
