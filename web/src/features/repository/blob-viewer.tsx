// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { t, plural } from '@lingui/core/macro'
import {
  Card,
  CardContent,
  Button,
  EmptyState,
  Skeleton,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  useFormat,
  toast,
  shellSaveBlob,
  shellClipboardWrite,
} from '@mochi/web'
import { File, Copy, Check, Download, FileCode, History } from 'lucide-react'
import { useBlob, useBranches } from '@/hooks/use-repository'
import { PathBreadcrumb } from '@/components/path-breadcrumb'
import { RefSelector } from '@/components/ref-selector'

interface BlobViewerProps {
  repoId: string
  fingerprint: string
  gitRef: string
  path: string
  name: string
}

export function BlobViewer({
  repoId,
  fingerprint,
  gitRef,
  path,
  name,
}: BlobViewerProps) {
  const { data, isLoading, error } = useBlob(repoId, gitRef, path)
  const { data: branchesData } = useBranches(repoId)
  const [copied, setCopied] = useState(false)
  const navigate = useNavigate()
  const { formatFileSize } = useFormat()
  const lines = useMemo(() => fileLines(data?.content), [data?.content])

  const branches = branchesData?.branches || []

  // Auto-redirect to tree view if blob fails (likely a directory)
  useEffect(() => {
    if (!isLoading && (error || !data)) {
      navigate({
        to: '/$repoId/tree/$ref/$',
        params: { repoId: fingerprint, ref: gitRef, _splat: path },
        replace: true,
      })
    }
  }, [isLoading, error, data, navigate, fingerprint, gitRef, path])

  const handleBranchChange = (newRef: string) => {
    navigate({
      to: '/$repoId/blob/$ref/$',
      params: { repoId: fingerprint, ref: newRef, _splat: path },
    })
  }

  const pathParts = path.split('/').filter(Boolean)
  const fileName = pathParts[pathParts.length - 1] || 'file'

  const handleCopy = async () => {
    if (data?.content) {
      // shellClipboardWrite, not navigator.clipboard: inside the shell's
      // sandboxed iframe the bare call rejects, and the ignored promise meant
      // the tick appeared whether or not anything reached the clipboard.
      if (await shellClipboardWrite(data.content)) {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    }
  }

  const handleDownload = () => {
    if (data?.content) {
      const blob = new Blob([data.content], { type: 'text/plain' })
      // A bare anchor-click save silently no-ops in the shell's sandboxed
      // iframe; shellSaveBlob hands the blob to the parent shell to save.
      void shellSaveBlob(blob, fileName).then((ok) => {
        if (!ok) toast.error(t`Failed to download`)
      })
    }
  }

  if (isLoading) {
    return (
      <div className='space-y-4'>
        <Skeleton className='h-10 w-48' />
        <Skeleton className='h-8 w-64' />
        <Card>
          <CardContent className='p-4'>
            <Skeleton className='h-64 w-full' />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !data) {
    // Will auto-redirect via useEffect, show loading state
    return (
      <div className='space-y-4'>
        <Skeleton className='h-10 w-48' />
        <Skeleton className='h-8 w-64' />
        <Card>
          <CardContent className='p-4'>
            <Skeleton className='h-64 w-full' />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      {/* Branch selector */}
      {branches.length > 0 && (
        <RefSelector
          branches={branches}
          value={gitRef}
          onValueChange={handleBranchChange}
        />
      )}

      <PathBreadcrumb
        fingerprint={fingerprint}
        gitRef={gitRef}
        name={name}
        pathParts={pathParts}
      />

      {/* File content */}
      <Card>
        <div className='bg-surface-2 flex items-center justify-between border-b px-4 py-2'>
          <div className='flex items-center gap-2 text-sm'>
            <FileCode className='h-4 w-4' />
            <span>{fileName}</span>
            <span className='text-muted-foreground'>
              {data.content != null
                ? `${formatFileSize(data.size)} · ${plural(lines.length, { one: '# line', other: '# lines' })}`
                : formatFileSize(data.size)}
            </span>
          </div>
          <div className='flex items-center gap-1'>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-8 w-8'
                  asChild
                  aria-label={t`History`}
                >
                  <Link
                    to='/$repoId/history/$ref/$'
                    params={{ repoId: fingerprint, ref: gitRef, _splat: path }}
                  >
                    <History className='h-4 w-4' />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t`History`}</TooltipContent>
            </Tooltip>
            {data.content != null && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='h-8 w-8'
                    onClick={handleCopy}
                    aria-label={t`Copy file contents`}
                  >
                    {copied ? (
                      <Check className='h-4 w-4' />
                    ) : (
                      <Copy className='h-4 w-4' />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t`Copy file contents`}</TooltipContent>
              </Tooltip>
            )}
            {data.content != null && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='h-8 w-8'
                    onClick={handleDownload}
                    aria-label={t`Download file`}
                  >
                    <Download className='h-4 w-4' />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t`Download file`}</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
        <CardContent className='p-0'>
          {data.binary ? (
            <EmptyState
              icon={File}
              title={t`Binary file (${formatFileSize(data.size)})`}
            />
          ) : data.content == null ? (
            <EmptyState
              icon={File}
              title={t`This file is too large to display (${formatFileSize(data.size)})`}
            />
          ) : (
            <FileLines lines={lines} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// A file is drawn in chunks of this many lines, each a column of line numbers
// beside a column of text. A chunk off screen is not laid out or painted until
// it nears the view: a file can run to tens of thousands of lines, and laying
// them all out was most of the page's work. Find in page still searches it.
const CHUNK = 500

// The tab width Tailwind's base styles give the page.
const TAB = 4

// fileLines splits a file into lines. A final newline ends the last line
// rather than starting an empty one, as git and wc count them.
function fileLines(content: string | undefined) {
  if (!content) return []
  return (content.endsWith('\n') ? content.slice(0, -1) : content).split('\n')
}

// The page's monospace font draws a character cell 0.6em wide. Characters it
// lacks come from fallback fonts: a wide East Asian character is drawn 1em
// wide, five thirds of a cell, and an emoji about two cells.
const WIDE = 5 / 3
const EMOJI = 2
const hidden = /[\p{M}\p{Cc}]/u
const wide =
  /[\u1100-\u115f\u2e80-\u303e\u3041-\u33ff\u3400-\u4dbf\u4e00-\u9fff\ua000-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6\u{20000}-\u{3fffd}]/u
const emoji = /[\u{1f300}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{1f900}-\u{1f9ff}]/u

// columns estimates the character cells a line takes: a tab runs to the next
// tab stop, and a combining mark or control character takes none. ASCII is
// counted from its character codes, since testing each character against a
// pattern took six times as long on a 1 MiB file.
function columns(line: string) {
  let count = 0
  for (let index = 0; index < line.length; index++) {
    const code = line.charCodeAt(index)
    if (code === 9) count += TAB - (count % TAB)
    else if (code >= 0x20 && code < 0x7f) count++
    else if (code >= 0x80) {
      const point = line.codePointAt(index)!
      if (point > 0xffff) index++
      const character = String.fromCodePoint(point)
      if (wide.test(character)) count += WIDE
      else if (emoji.test(character)) count += EMOJI
      else if (!hidden.test(character)) count++
    }
  }
  return count
}

function FileLines({ lines }: { lines: string[] }) {
  const chunks = useMemo(() => {
    const result = []
    for (let start = 0; start < lines.length; start += CHUNK) {
      const slice = lines.slice(start, start + CHUNK)
      result.push({
        start,
        count: slice.length,
        numbers: slice.map((_, index) => start + index + 1).join('\n'),
        text: slice.join('\n'),
        width: Math.max(...slice.map(columns)),
      })
    }
    return result
  }, [lines])

  // Every chunk's number column is as wide as the file's last number, so the
  // columns line up from one chunk to the next.
  const digits = String(lines.length).length

  return (
    <div className='overflow-x-auto'>
      {chunks.map((chunk) => (
        // Until a chunk is drawn its size is estimated from its lines, so the
        // scrollbars hold still; once drawn the browser keeps the real one.
        // Each chunk is as wide as its own text, since content-visibility
        // clips whatever overflows the chunk.
        <div
          key={chunk.start}
          className='flex w-max min-w-full font-mono text-sm [content-visibility:auto]'
          style={{
            containIntrinsicWidth: `auto calc(${Math.round((digits + chunk.width) * 10) / 10}ch + 4rem + 1px)`,
            containIntrinsicHeight: `auto ${chunk.count}lh`,
          }}
        >
          <pre
            aria-hidden
            className='text-muted-foreground shrink-0 border-e px-4 text-end select-none'
            style={{ width: `calc(${digits}ch + 2rem + 1px)` }}
          >
            {chunk.numbers}
          </pre>
          <pre className='px-4'>{chunk.text}</pre>
        </div>
      ))}
    </div>
  )
}
