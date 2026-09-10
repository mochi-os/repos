// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { useState, useEffect } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { t, plural } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import {
  Card,
  CardContent,
  Button,
  Skeleton,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  useFormat,
  toast,
  shellSaveBlob,
  shellClipboardWrite,
} from '@mochi/web'
import {
  File,
  ChevronRight,
  Copy,
  Check,
  Download,
  FileCode,
} from 'lucide-react'
import { useBlob, useBranches } from '@/hooks/use-repository'
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

  const lines = data.content?.split('\n') || []

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

      {/* Breadcrumb */}
      <div className='flex flex-wrap items-center gap-1 text-sm'>
        <Link
          to='/$repoId/tree/$ref/$'
          params={{ repoId: fingerprint, ref: gitRef, _splat: '' }}
          className='text-primary hover:underline'
        >
          {name}
        </Link>
        {pathParts.map((part, index) => {
          const pathTo = pathParts.slice(0, index + 1).join('/')
          const isLast = index === pathParts.length - 1
          return (
            <span key={pathTo} className='flex items-center gap-1'>
              <ChevronRight className='text-muted-foreground h-4 w-4 rtl:rotate-180' />
              {isLast ? (
                <span className='text-foreground font-medium'>{part}</span>
              ) : (
                <Link
                  to='/$repoId/tree/$ref/$'
                  params={{ repoId: fingerprint, ref: gitRef, _splat: pathTo }}
                  className='text-primary hover:underline'
                >
                  {part}
                </Link>
              )}
            </span>
          )
        })}
      </div>

      {/* File content */}
      <Card>
        <div className='bg-surface-2 flex items-center justify-between border-b px-4 py-2'>
          <div className='flex items-center gap-2 text-sm'>
            <FileCode className='h-4 w-4' />
            <span>{fileName}</span>
            <span className='text-muted-foreground'>
              {data.content != null
                ? `${formatFileSize(data.size)} · ${plural(lines.length, { one: '1 line', other: '# lines' })}`
                : formatFileSize(data.size)}
            </span>
          </div>
          <div className='flex items-center gap-1'>
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
            <div className='text-muted-foreground p-8 text-center'>
              <File className='mx-auto mb-2 h-12 w-12' />
              <p>
                <Trans>Binary file ({formatFileSize(data.size)})</Trans>
              </p>
            </div>
          ) : data.content == null ? (
            <div className='text-muted-foreground p-8 text-center'>
              <File className='mx-auto mb-2 h-12 w-12' />
              <p>
                <Trans>
                  This file is too large to display ({formatFileSize(data.size)}
                  )
                </Trans>
              </p>
            </div>
          ) : (
            <div className='overflow-x-auto'>
              <pre className='text-sm'>
                <code>
                  <table className='w-full border-collapse'>
                    <tbody>
                      {lines.map((line, index) => (
                        <tr key={index} className='hover:bg-hover'>
                          <td className='text-muted-foreground w-12 border-e px-4 py-0 text-end align-top select-none'>
                            {index + 1}
                          </td>
                          <td className='px-4 py-0 whitespace-pre'>
                            {line || ' '}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </code>
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
