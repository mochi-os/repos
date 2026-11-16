// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import type { ReactNode, Ref } from 'react'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { TagsList } from './tags-list'

const hooks = vi.hoisted(() => ({
  useTags: vi.fn(),
}))

// How many times a row has been drawn, and the list sorted.
const counts = vi.hoisted(() => ({ rows: 0, compares: 0 }))

vi.mock('@/hooks/use-repository', () => hooks)
vi.mock('@/api/request', () => ({ reposRequest: { download: vi.fn() } }))
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    ref,
    ...rest
  }: {
    children: ReactNode
    to: string
    params: Record<string, string>
    ref?: Ref<HTMLAnchorElement>
  }) => (
    <a
      ref={ref}
      href={Object.entries(params).reduce(
        (path, [key, value]) =>
          path.replace(key === '_splat' ? '$' : `$${key}`, value),
        to
      )}
      {...rest}
    >
      {children}
    </a>
  ),
}))
vi.mock('@mochi/web', async (importOriginal) => {
  const original = await importOriginal<typeof import('@mochi/web')>()
  return {
    ...original,
    useFormat: () => {
      counts.rows++
      return { formatTimestamp: (time: number) => `at ${time}` }
    },
    naturalCompare: (a: string, b: string) => {
      counts.compares++
      return original.naturalCompare(a, b)
    },
  }
})

beforeAll(() => {
  i18n.loadAndActivate({ locale: 'en', messages: {} })
  // Radix sizes an open menu with ResizeObserver, which jsdom lacks.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

const TAGS = [
  { name: '1.0', sha: 'aaaaaaa1', message: 'First', tagger: 'Ada', date: 10 },
  { name: '2.0', sha: 'ccccccc3' },
  { name: '1.1', sha: 'bbbbbbb2', message: 'Second' },
]

function show(tags: object[] = TAGS) {
  const data = { tags }
  hooks.useTags.mockReturnValue({ data, isLoading: false, error: null })
  const tree = () => (
    <I18nProvider i18n={i18n}>
      <TagsList repoId='repo' fingerprint='repo-fingerprint' />
    </I18nProvider>
  )
  const result = render(tree())
  return { ...result, again: () => result.rerender(tree()) }
}

// The rows, newest version first.
function rows(container: HTMLElement) {
  return [
    ...container.querySelectorAll<HTMLElement>(
      '[data-slot="card-content"] > div'
    ),
  ]
}

// The Radix pieces a row mounts once reached.
function radix(row: HTMLElement) {
  return {
    tooltips: row.querySelectorAll('[data-slot="tooltip-trigger"]').length,
    menus: row.querySelectorAll('[aria-haspopup="menu"]').length,
  }
}

function download(row: HTMLElement) {
  return row.querySelector<HTMLElement>('button[aria-label="Download"]')!
}

afterEach(() => {
  cleanup()
  counts.rows = 0
  counts.compares = 0
})

describe('TagsList', () => {
  it('draws its rows with no tooltip or menu until one is reached', () => {
    const { container } = show()
    const drawn = rows(container)
    expect(drawn).toHaveLength(3)
    for (const row of drawn) {
      // THE POINT: thousands of rows mount no Radix component at load.
      expect(radix(row)).toEqual({ tooltips: 0, menus: 0 })
      expect(download(row)).not.toBeNull()
    }
  })

  it('mounts a row tooltip and menu when the pointer reaches it, and only that row', () => {
    const { container } = show()
    const [first, second] = rows(container)
    fireEvent.pointerEnter(first, { pointerType: 'mouse' })
    expect(radix(first)).toEqual({ tooltips: 2, menus: 1 })
    expect(radix(second)).toEqual({ tooltips: 0, menus: 0 })
  })

  it('mounts nothing for a touch, so a tap on the compare link is not lost', () => {
    const { container } = show()
    const row = rows(container)[0]
    const compare = row.querySelector('a[aria-label="Compare with 1.1"]')
    fireEvent.pointerEnter(row, { pointerType: 'touch' })
    // THE POINT: the link the finger is on is the one the click reaches.
    expect(radix(row)).toEqual({ tooltips: 0, menus: 0 })
    expect(row.querySelector('a[aria-label="Compare with 1.1"]')).toBe(compare)
  })

  it('leaves the row as it is for the focus a tap gives its compare link', () => {
    const { container } = show()
    const row = rows(container)[0]
    const compare = row.querySelector<HTMLElement>(
      'a[aria-label="Compare with 1.1"]'
    )!
    // A tap's focus is not keyboard focus.
    const matches = Element.prototype.matches
    const spy = vi
      .spyOn(Element.prototype, 'matches')
      .mockImplementation(function (this: Element, selector: string) {
        return selector === ':focus-visible'
          ? false
          : matches.call(this, selector)
      })
    try {
      act(() => compare.focus())
    } finally {
      spy.mockRestore()
    }
    // THE POINT: the link the tap's click goes to is still in the page.
    expect(radix(row)).toEqual({ tooltips: 0, menus: 0 })
    expect(compare.isConnected).toBe(true)
  })

  it('opens the menu when the plain download button is tapped', () => {
    const { container } = show()
    fireEvent.pointerDown(download(rows(container)[0]), {
      pointerType: 'touch',
      button: 0,
    })
    expect(screen.getByRole('menu')).not.toBeNull()
  })

  it('keeps focus on the download button when focus reaching it mounts the menu', () => {
    const { container } = show()
    const row = rows(container)[1]
    act(() => download(row).focus())
    // THE POINT: the plain button was replaced, and focus went with it.
    expect(radix(row).menus).toBe(1)
    expect(document.activeElement).toBe(download(row))
    expect(document.activeElement?.getAttribute('aria-haspopup')).toBe('menu')
  })

  it('opens the menu when the plain download button is pressed', () => {
    const { container } = show()
    // A press with no pointer or focus reaching the row first, as a screen
    // reader sends.
    fireEvent.click(download(rows(container)[0]))
    expect(screen.getByRole('menu')).not.toBeNull()
    expect(
      screen.getAllByRole('menuitem').map((item) => item.textContent)
    ).toEqual(['tar.bz2', 'tar.gz', 'zip'])
  })

  it('compares each tag with the one before it', () => {
    const { container } = show()
    const links = rows(container).map((row) =>
      [...row.querySelectorAll('a')].map((link) => [
        link.getAttribute('aria-label'),
        link.getAttribute('href'),
      ])
    )
    expect(links).toEqual([
      [
        [null, '/repo-fingerprint/tree/2.0/'],
        ['Compare with 1.1', '/repo-fingerprint/compare/1.1...2.0'],
      ],
      [
        [null, '/repo-fingerprint/tree/1.1/'],
        ['Compare with 1.0', '/repo-fingerprint/compare/1.0...1.1'],
      ],
      [[null, '/repo-fingerprint/tree/1.0/']],
    ])
  })

  it('sizes each row ahead from the lines it shows', () => {
    const { container } = show()
    const styles = rows(container).map((row) => [
      row.className.includes('[content-visibility:auto]'),
      row.style.getPropertyValue('contain-intrinsic-height'),
    ])
    expect(styles).toEqual([
      [true, 'auto max(var(--control-height-md), 1.5rem)'],
      [true, 'auto max(var(--control-height-md), 2.75rem)'],
      [true, 'auto max(var(--control-height-md), 4rem)'],
    ])
  })

  it('draws no row again when the list redraws with the same tags', () => {
    const { again } = show()
    expect(counts.rows).toBe(3)
    again()
    expect(counts.rows).toBe(3)
  })

  it('sorts the tags once for the same answer', () => {
    // Tags of one date sort by name.
    const { again } = show([
      { name: 'beta', sha: 'b', date: 5 },
      { name: 'alpha', sha: 'a', date: 5 },
      { name: 'gamma', sha: 'c', date: 5 },
    ])
    const sorted = counts.compares
    expect(sorted).toBeGreaterThan(0)
    again()
    expect(counts.compares).toBe(sorted)
  })
})
