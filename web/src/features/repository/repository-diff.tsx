// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Link } from '@tanstack/react-router'
import { plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  Button,
  DiffLines,
  DiffViewer,
  DiffViewToggle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Switch,
  compareText,
  useScreenSize,
  type DiffFile,
  type DiffViewStyle,
} from '@mochi/web'
import {
  FileCode,
  FileText,
  History,
  ListPlus,
  MoreHorizontal,
  X,
} from 'lucide-react'
import {
  CONTEXTS,
  DEFAULT_CONTEXT,
  type Context,
  type DiffOptions,
} from '@/lib/diff-options'
import { useFileSides } from '@/hooks/use-repository'

// Comparing a file again in the browser gives up after this long, rather than
// holding the page while it works through a very large file.
const COMPARE_TIMEOUT = 1000

// The row of controls above a diff: what is compared, then whitespace, context
// and the one or two column switch. Pages put it in the repository header's
// sticky bar, so it stays in view while a long diff scrolls under it.
export function DiffBar({
  label,
  options,
  onOptions,
  style,
  onStyle,
  path,
  onPath,
  children,
}: {
  label: ReactNode
  options: DiffOptions
  onOptions: (options: DiffOptions) => void
  style: DiffViewStyle
  onStyle: (style: DiffViewStyle) => void
  // The file or folder the diff is limited to, if any.
  path?: string
  onPath?: (path: string | undefined) => void
  children?: ReactNode
}) {
  const { t } = useLingui()
  // Two columns leave each side too narrow to read on a phone, so there the
  // diff stays in one column and the switch is not offered.
  const { isMobile } = useScreenSize()
  const context = options.context ?? DEFAULT_CONTEXT
  return (
    <div className='flex flex-wrap items-center justify-between gap-2'>
      <div className='flex min-w-0 flex-wrap items-center gap-2'>
        <p className='text-muted-foreground text-xs'>{label}</p>
        {path && onPath && (
          <span className='bg-muted inline-flex max-w-full items-center gap-1 rounded-md py-0.5 ps-2 pe-0.5 font-mono text-xs'>
            <span className='truncate'>{path}</span>
            <button
              type='button'
              onClick={() => onPath(undefined)}
              aria-label={t`Show all files`}
              className='hover:bg-hover rounded p-0.5'
            >
              <X className='size-3' />
            </button>
          </span>
        )}
      </div>
      <div className='flex flex-wrap items-center gap-3'>
        {children}
        <div className='flex items-center gap-2'>
          <Switch
            id='diff-whitespace'
            checked={options.whitespace === 'ignore'}
            onCheckedChange={(checked) =>
              onOptions({
                ...options,
                whitespace: checked ? 'ignore' : undefined,
              })
            }
          />
          <Label htmlFor='diff-whitespace' className='text-xs font-normal'>
            <Trans>Ignore whitespace</Trans>
          </Label>
        </div>
        <Select
          value={String(context)}
          onValueChange={(value) => {
            const step = CONTEXTS.find((option) => String(option) === value)
            onOptions({
              ...options,
              context: step === DEFAULT_CONTEXT ? undefined : step,
            })
          }}
        >
          <SelectTrigger size='sm' aria-label={t`Context`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CONTEXTS.map((step) => (
              <SelectItem key={step} value={String(step)}>
                {step === 'all'
                  ? t`Whole files`
                  : plural(step, {
                      one: '# line of context',
                      other: '# lines of context',
                    })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!isMobile && <DiffViewToggle value={style} onChange={onStyle} />}
      </div>
    </div>
  )
}

// What a file's options and body need to know about the comparison.
interface Scope {
  repoId: string
  fingerprint: string
  // The commit the comparison starts from, empty for nothing at all, and the
  // commit it ends at.
  start: string
  head: string
  options: DiffOptions
  // Context a reader asked for on one file, by path.
  overrides: Record<string, Context>
  widen: (path: string, context: Context) => void
}

const ScopeContext = createContext<Scope | undefined>(undefined)

function useScope(): Scope {
  const scope = useContext(ScopeContext)
  if (!scope) throw new Error('RepositoryDiff provides the diff scope')
  return scope
}

// The context one file is shown with: the reader's own choice for it, else
// the page's.
function fileContext(scope: Scope, file: DiffFile): Context {
  return scope.overrides[file.path] ?? scope.options.context ?? DEFAULT_CONTEXT
}

// A file whose lines can be compared again: it has lines, and the server
// compared it.
function comparable(file: DiffFile): boolean {
  return !file.isBinary && !file.skipped && file.hunks.length > 0
}

// The two sides of a file: where it was at the start and where it is at the
// end. A file that was added has no start side, one that was deleted no end.
function fileSides(scope: Scope, file: DiffFile) {
  const before =
    scope.start && file.status !== 'added'
      ? { ref: scope.start, path: file.oldPath ?? file.path }
      : undefined
  const after =
    file.status !== 'deleted' ? { ref: scope.head, path: file.path } : undefined
  return { before, after }
}

// A file's overflow menu: more context for this file alone, the whole file,
// and the file itself and its history.
function FileActions({ file }: { file: DiffFile }) {
  const { t } = useLingui()
  const scope = useScope()
  const context = fileContext(scope, file)
  const wider =
    context === 'all'
      ? undefined
      : CONTEXTS.find((step) => step === 'all' || step > context)
  const { before, after } = fileSides(scope, file)
  const side = after ?? before
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className='size-7'
          aria-label={t`File options`}
        >
          <MoreHorizontal className='size-4' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        {comparable(file) && context !== 'all' && wider !== undefined && (
          <DropdownMenuItem onClick={() => scope.widen(file.path, wider)}>
            <ListPlus className='me-2 size-4' />
            {t`Show more lines`}
          </DropdownMenuItem>
        )}
        {comparable(file) && context !== 'all' && (
          <DropdownMenuItem onClick={() => scope.widen(file.path, 'all')}>
            <FileText className='me-2 size-4' />
            {t`Show whole file`}
          </DropdownMenuItem>
        )}
        {side && (
          <DropdownMenuItem asChild>
            <Link
              to='/$repoId/blob/$ref/$'
              params={{
                repoId: scope.fingerprint,
                ref: side.ref,
                _splat: side.path,
              }}
            >
              <FileCode className='me-2 size-4' />
              {t`View file`}
            </Link>
          </DropdownMenuItem>
        )}
        {side && (
          <DropdownMenuItem asChild>
            <Link
              to='/$repoId/history/$ref/$'
              params={{
                repoId: scope.fingerprint,
                ref: side.ref,
                _splat: side.path,
              }}
            >
              <History className='me-2 size-4' />
              {t`History`}
            </Link>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// A file's lines. The server's comparison is shown as it came unless the
// reader asked for other options, which compares the file's two versions
// again in the browser.
function FileBody({
  file,
  viewStyle,
}: {
  file: DiffFile
  viewStyle: DiffViewStyle
}) {
  const scope = useScope()
  const context = fileContext(scope, file)
  const ignore = scope.options.whitespace === 'ignore'
  const again = comparable(file) && (context !== DEFAULT_CONTEXT || ignore)
  const { before, after } = fileSides(scope, file)
  const sides = useFileSides(scope.repoId, before, after, again)
  const compared = useMemo(() => {
    if (
      !again ||
      typeof sides.before !== 'string' ||
      typeof sides.after !== 'string'
    ) {
      return undefined
    }
    return {
      file: compareText(sides.before, sides.after, {
        context,
        whitespace: ignore ? 'ignore' : undefined,
        timeout: COMPARE_TIMEOUT,
      }),
    }
  }, [again, sides.before, sides.after, context, ignore])

  if (!again) return <DiffLines file={file} viewStyle={viewStyle} />
  if (sides.isLoading) {
    return (
      <div className='space-y-2 p-3'>
        <Skeleton className='h-4 w-full' />
        <Skeleton className='h-4 w-3/4' />
      </div>
    )
  }
  // Either side unavailable (binary, too large to send, or the request
  // failed), or the comparison gave up: the server's comparison still stands.
  if (!compared || compared.file === null) {
    return (
      <>
        <p className='text-muted-foreground border-b px-3 py-2 text-xs'>
          <Trans>This file cannot be compared with these options.</Trans>
        </p>
        <DiffLines file={file} viewStyle={viewStyle} />
      </>
    )
  }
  if (compared.file === undefined) {
    return (
      <p className='text-muted-foreground px-3 py-4 text-sm'>
        <Trans>No changes other than whitespace</Trans>
      </p>
    )
  }
  return (
    <DiffLines
      file={{ ...file, hunks: compared.file.hunks }}
      viewStyle={viewStyle}
    />
  )
}

// A comparison of two commits: every changed file, with per-file options. The
// caller keys it by what it compares, so a file's own options do not carry
// over to another comparison.
export function RepositoryDiff({
  repoId,
  fingerprint,
  start,
  head,
  diff,
  options,
  style,
}: {
  repoId: string
  fingerprint: string
  start: string
  head: string
  diff: string
  options: DiffOptions
  style: DiffViewStyle
}) {
  const { isMobile } = useScreenSize()
  const [overrides, setOverrides] = useState<Record<string, Context>>({})
  const scope = useMemo<Scope>(
    () => ({
      repoId,
      fingerprint,
      start,
      head,
      options,
      overrides,
      widen: (path, context) =>
        setOverrides((previous) => ({ ...previous, [path]: context })),
    }),
    [repoId, fingerprint, start, head, options, overrides]
  )
  return (
    <ScopeContext.Provider value={scope}>
      <DiffViewer
        diff={diff}
        viewStyle={isMobile ? 'unified' : style}
        actions={FileActions}
        body={FileBody}
      />
    </ScopeContext.Provider>
  )
}
