// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reposRequest } from './request'

const { saved } = vi.hoisted(() => ({ saved: vi.fn() }))

vi.mock('@mochi/web', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@mochi/web')>()),
  shellSaveBlob: saved,
}))

// A download goes through the shared client as a blob and is saved under the
// name the server gives in Content-Disposition.
describe('reposRequest.download', () => {
  const fetched = vi.fn()

  beforeEach(() => {
    saved.mockReset().mockResolvedValue(true)
    fetched.mockReset()
    vi.stubGlobal('fetch', fetched)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('saves the bytes under the name the server gives', async () => {
    fetched.mockResolvedValue(
      new Response('zip bytes', {
        headers: { 'Content-Disposition': 'attachment; filename="repo.zip"' },
      })
    )
    await reposRequest.download('archive/zip', 'archive.zip')
    const [blob, name] = saved.mock.calls[0] as [Blob, string]
    expect(name).toBe('repo.zip')
    expect(await blob.text()).toBe('zip bytes')
    expect(fetched.mock.calls[0][1].method).toBe('GET')
  })

  it('falls back to the given name without Content-Disposition', async () => {
    fetched.mockResolvedValue(new Response('zip bytes'))
    await reposRequest.download('archive/zip', 'archive.zip')
    expect(saved.mock.calls[0][1]).toBe('archive.zip')
  })

  it('fails when the server refuses, with the response attached', async () => {
    fetched.mockResolvedValue(
      new Response('{"error":"not_found"}', { status: 404 })
    )
    const error = (await reposRequest
      .download('archive/zip', 'archive.zip')
      .catch((e: unknown) => e)) as { response?: { status: number } }
    expect(error.response?.status).toBe(404)
    expect(saved).not.toHaveBeenCalled()
  })
})
