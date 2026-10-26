// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import type { ReactNode } from 'react'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BlobViewer } from './blob-viewer'

const hooks = vi.hoisted(() => ({
  useBlob: vi.fn(),
  useBranches: () => ({ data: { branches: [] } }),
}))

vi.mock('@/hooks/use-repository', () => hooks)
vi.mock('@/components/path-breadcrumb', () => ({ PathBreadcrumb: () => null }))
vi.mock('@/components/ref-selector', () => ({ RefSelector: () => null }))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  useNavigate: () => vi.fn(),
}))
vi.mock('@mochi/web', async (importOriginal) => ({
  ...(await importOriginal()),
  useFormat: () => ({ formatFileSize: (size: number) => `${size} B` }),
}))

function show(content: string) {
  hooks.useBlob.mockReturnValue({
    data: { content, size: content.length, binary: false },
    isLoading: false,
    error: null,
  })
  return render(
    <I18nProvider i18n={i18n}>
      <BlobViewer
        repoId='repo'
        fingerprint='repo-fingerprint'
        gitRef='main'
        path='server/file.go'
        name='Repository'
      />
    </I18nProvider>
  )
}

// The drawn chunks, each with its number column, text column and style.
function chunks(container: HTMLElement) {
  return [
    ...container.querySelectorAll<HTMLElement>('.overflow-x-auto > div'),
  ].map((chunk) => {
    const [numbers, text] = chunk.querySelectorAll('pre')
    return {
      style: chunk.getAttribute('style') ?? '',
      gutter: numbers.getAttribute('style') ?? '',
      numbers: numbers.textContent ?? '',
      text: text.textContent ?? '',
    }
  })
}

function file(count: number) {
  return Array.from({ length: count }, (_, index) => `line ${index + 1}`)
}

beforeEach(() => {
  i18n.loadAndActivate({ locale: 'en', messages: {} })
  hooks.useBlob.mockReset()
})

afterEach(cleanup)

describe('file lines', () => {
  it.each([
    ['with', '\n'],
    ['without', ''],
  ])('numbers every line of a file %s a final newline', (_, end) => {
    const lines = file(1234)
    const { container } = show(lines.join('\n') + end)

    expect(screen.getByText(/1,234 lines/)).toBeTruthy()
    const drawn = chunks(container)
    expect(drawn.map((chunk) => chunk.numbers.split('\n')[0])).toEqual([
      '1',
      '501',
      '1001',
    ])
    for (const chunk of drawn) {
      expect(chunk.text.split('\n')).toHaveLength(
        chunk.numbers.split('\n').length
      )
    }
    expect(drawn.map((chunk) => chunk.numbers).join('\n')).toBe(
      lines.map((_, index) => index + 1).join('\n')
    )
    expect(drawn.map((chunk) => chunk.text).join('\n')).toBe(lines.join('\n'))
  })

  it('keeps blank lines, including a last one', () => {
    const { container } = show('first\n\nthird\n\n')

    expect(screen.getByText(/4 lines/)).toBeTruthy()
    const [chunk] = chunks(container)
    expect(chunk.numbers).toBe('1\n2\n3\n4')
    expect(chunk.text).toBe('first\n\nthird\n')
  })

  it('draws an empty file as no lines', () => {
    const { container } = show('')

    expect(screen.getByText(/0 lines/)).toBeTruthy()
    expect(chunks(container)).toEqual([])
  })

  it('creates a few elements per 500 lines, not per line', () => {
    const { container } = show(file(25000).join('\n'))

    const area = container.querySelector('.overflow-x-auto')!
    expect(area.querySelectorAll('*')).toHaveLength(50 * 3)
  })

  it('sizes each chunk from its own lines until it is drawn', () => {
    const { container } = show(file(1234).join('\n'))

    // 1,234 lines need four digits. The first chunk's longest line is
    // "line 500" at 8 columns, the others' "line 1000" and "line 1234" at 9.
    expect(chunks(container).map((chunk) => chunk.style)).toEqual([
      'contain-intrinsic-width: auto calc(12ch + 4rem + 1px); contain-intrinsic-height: auto 500lh;',
      'contain-intrinsic-width: auto calc(13ch + 4rem + 1px); contain-intrinsic-height: auto 500lh;',
      'contain-intrinsic-width: auto calc(13ch + 4rem + 1px); contain-intrinsic-height: auto 234lh;',
    ])
  })

  it('gives every chunk the number column of the last line', () => {
    const { container } = show(file(1234).join('\n'))

    // The first chunk's own numbers would need only three digits.
    const gutters = chunks(container).map((chunk) => chunk.gutter)
    expect(gutters).toHaveLength(3)
    expect(new Set(gutters).size).toBe(1)
    expect(gutters[0]).toMatch(/calc\(4ch /)
  })

  it.each([
    ['plain text', 'abcdef', 6],
    ['a tab to the next stop', 'a\tb', 5],
    ['tabs on a stop', '\t\tx', 9],
    ['wide characters, 1em in a 0.6em cell', '日本語', 5],
    ['a wide character before a tab', '日\tx', 5],
    ['an emoji', 'ok 🙂', 5],
    ['wide characters and an emoji', 'ab日🙂', 5.7],
    ['a combining mark', 'cafe\u0301', 4],
    ['a carriage return', 'line\r', 4],
    ['a Unicode control character', 'next\u0085line', 8],
  ])('counts the columns of %s', (_, line, width) => {
    const { container } = show(`x\n${line}\n`)

    // Two lines need one digit; widths are rounded to a tenth of a cell.
    expect(chunks(container)[0].style).toContain(
      `contain-intrinsic-width: auto calc(${Math.round((1 + width) * 10) / 10}ch + 4rem + 1px);`
    )
  })
})
