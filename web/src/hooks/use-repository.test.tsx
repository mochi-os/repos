// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@mochi/web'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDiffStyle } from './use-repository'

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/api/request', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/request')>()),
  reposRequest: { get, post },
}))

describe('useDiffStyle', () => {
  const withQueries = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      {children}
    </QueryClientProvider>
  )

  beforeEach(() => {
    get.mockReset()
    post.mockReset()
    get.mockResolvedValue({ style: 'unified' })
    post.mockImplementation(async (_url: string, body: unknown) => body)
  })

  const pick = async (authenticated: boolean) => {
    useAuthStore.setState({ isAuthenticated: authenticated })
    const { result } = renderHook(() => useDiffStyle(), {
      wrapper: withQueries,
    })
    await waitFor(() => expect(get).toHaveBeenCalled())
    act(() => result.current[1]('split'))
    expect(result.current[0]).toBe('split')
  }

  it("saves a signed-in reader's choice as their preference", async () => {
    await pick(true)
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('diff/preference/set', {
        style: 'split',
      })
    )
  })

  // The preference cannot be kept for a reader who is not signed in, and the
  // server refuses the write; the choice lasts as long as the page.
  it("keeps a signed-out reader's choice on the page and sends nothing", async () => {
    await pick(false)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(post).not.toHaveBeenCalled()
  })
})
