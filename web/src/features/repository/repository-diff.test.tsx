// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import type { ReactNode } from 'react'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DiffOptions } from '@/lib/diff-options'
import { RepositoryDiff } from './repository-diff'

const hooks = vi.hoisted(() => ({ useFileSides: vi.fn() }))

vi.mock('@/hooks/use-repository', () => hooks)
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}))
// The menu opens on pointer events jsdom does not dispatch; its items are
// drawn in place so a test can press them.
vi.mock('@mochi/web', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@mochi/web')>()),
  useScreenSize: () => ({ isMobile: false }),
  DropdownMenu: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
    asChild,
  }: {
    children: ReactNode
    onClick?: () => void
    asChild?: boolean
  }) =>
    asChild ? (
      <>{children}</>
    ) : (
      <button type='button' onClick={onClick}>
        {children}
      </button>
    ),
}))

const start = 'a'.repeat(40)
const head = 'b'.repeat(40)

// Twenty lines, the tenth edited; the server sends three lines either side.
const before = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`)
const after = [...before]
after[9] = 'line ten'
const serverDiff =
  'diff --git a/src/a.go b/src/a.go\n--- a/src/a.go\n+++ b/src/a.go\n@@ -7,7 +7,7 @@\n' +
  [
    ' line 7',
    ' line 8',
    ' line 9',
    '-line 10',
    '+line ten',
    ' line 11',
    ' line 12',
    ' line 13',
  ]
    .map((line) => line + '\n')
    .join('')

function show(options: DiffOptions, diff = serverDiff) {
  return render(
    <I18nProvider i18n={i18n}>
      <RepositoryDiff
        repoId='repo'
        fingerprint='fingerprint'
        start={start}
        head={head}
        diff={diff}
        options={options}
        style='unified'
      />
    </I18nProvider>
  )
}

const sides = (old: string | null, current: string | null) => ({
  before: old,
  after: current,
  isLoading: false,
  error: undefined,
})

beforeEach(() => {
  i18n.loadAndActivate({ locale: 'en', messages: {} })
  hooks.useFileSides.mockReset()
  hooks.useFileSides.mockReturnValue(
    sides(before.join('\n') + '\n', after.join('\n') + '\n')
  )
})

afterEach(cleanup)

describe('RepositoryDiff', () => {
  it("shows the server's comparison as it came, fetching nothing", () => {
    show({})
    expect(screen.getByText('line 7')).toBeTruthy()
    expect(screen.queryByText('line 1')).toBeNull()
    expect(hooks.useFileSides).toHaveBeenLastCalledWith(
      'repo',
      { ref: start, path: 'src/a.go' },
      { ref: head, path: 'src/a.go' },
      false
    )
  })

  it('compares the two versions again for the whole file', () => {
    show({ context: 'all' })
    expect(hooks.useFileSides).toHaveBeenLastCalledWith(
      'repo',
      { ref: start, path: 'src/a.go' },
      { ref: head, path: 'src/a.go' },
      true
    )
    expect(screen.getByText('line 1')).toBeTruthy()
    expect(screen.getByText('line 20')).toBeTruthy()
  })

  it('widens one file from its menu', () => {
    show({})
    expect(screen.queryByText('line 1')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show whole file' }))
    expect(screen.getByText('line 1')).toBeTruthy()
  })

  it('says so when a file changed only in its spacing', () => {
    hooks.useFileSides.mockReturnValue(
      sides('if (a  &&  b) {\n', 'if (a && b) {\n')
    )
    show(
      { whitespace: 'ignore' },
      'diff --git a/x.go b/x.go\n--- a/x.go\n+++ b/x.go\n@@ -1 +1 @@\n-if (a  &&  b) {\n+if (a && b) {\n'
    )
    expect(screen.getByText('No changes other than whitespace')).toBeTruthy()
  })

  it("keeps the server's comparison when a version cannot be fetched", () => {
    hooks.useFileSides.mockReturnValue(sides(null, after.join('\n')))
    show({ context: 'all' })
    expect(
      screen.getByText('This file cannot be compared with these options.')
    ).toBeTruthy()
    expect(screen.getByText('line 7')).toBeTruthy()
    expect(screen.queryByText('line 1')).toBeNull()
  })

  it('reads an added file against nothing', () => {
    show(
      { context: 'all' },
      'diff --git a/new.go b/new.go\nnew file mode 100644\n--- /dev/null\n+++ b/new.go\n@@ -0,0 +1 @@\n+fresh\n'
    )
    expect(hooks.useFileSides).toHaveBeenLastCalledWith(
      'repo',
      undefined,
      { ref: head, path: 'new.go' },
      true
    )
  })
})
