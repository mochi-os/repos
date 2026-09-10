// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  EntityAvatar,
  Skeleton,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  getErrorMessage,
  useFormat,
  shellClipboardWrite,
} from '@mochi/web'
import { GitCommit, Calendar, Copy, Check } from 'lucide-react'
import { useCommit } from '@/hooks/use-repository'

interface CommitDetailsProps {
  repoId: string
  fingerprint: string
  sha: string
}

export function CommitDetails({
  repoId,
  fingerprint,
  sha,
}: CommitDetailsProps) {
  const { t } = useLingui()
  const { formatTimestamp } = useFormat()
  const { data, isLoading, error } = useCommit(repoId, sha)
  const [copied, setCopied] = useState(false)

  const handleCopySha = async () => {
    // See blob-viewer: the bare clipboard call silently rejects in the shell.
    if (await shellClipboardWrite(sha)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (isLoading) {
    return (
      <div className='space-y-4'>
        <Skeleton className='h-32 w-full' />
        <Skeleton className='h-64 w-full' />
      </div>
    )
  }

  if (error) {
    return (
      <div className='text-destructive'>
        {getErrorMessage(error, t`Failed to load commit`)}
      </div>
    )
  }

  const commit = data?.commit
  if (!commit) {
    return (
      <div className='text-muted-foreground'>
        <Trans>Commit not found</Trans>
      </div>
    )
  }

  const messageLines = commit.message.split('\n')
  const title = messageLines[0]
  const body = messageLines.slice(1).join('\n').trim()

  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader>
          <div className='flex items-start justify-between gap-4'>
            <div className='min-w-0 flex-1'>
              <CardTitle className='text-xl'>{title}</CardTitle>
              {body && (
                <pre className='text-muted-foreground mt-4 font-sans text-sm whitespace-pre-wrap'>
                  {body}
                </pre>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className='flex flex-wrap items-center gap-4 text-sm'>
            <div className='flex items-center gap-2'>
              <EntityAvatar
                seed={commit.author_email || commit.author}
                name={commit.author}
                size='sm'
              />
              <span>{commit.author}</span>
              {commit.author_email && (
                <span className='text-muted-foreground'>
                  &lt;{commit.author_email}&gt;
                </span>
              )}
            </div>
            <div className='flex items-center gap-2'>
              <Calendar className='text-muted-foreground h-4 w-4' />
              <span>{formatTimestamp(commit.date)}</span>
            </div>
          </div>

          <div className='bg-muted mt-4 flex items-center gap-2 rounded-md p-2'>
            <GitCommit className='text-muted-foreground h-4 w-4' />
            <code className='flex-1 font-mono text-sm'>{sha}</code>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant='ghost'
                  size='icon'
                  className='h-8 w-8'
                  onClick={handleCopySha}
                  aria-label={t`Copy commit SHA`}
                >
                  {copied ? (
                    <Check className='h-4 w-4' />
                  ) : (
                    <Copy className='h-4 w-4' />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t`Copy commit SHA`}</TooltipContent>
            </Tooltip>
          </div>

          {commit.parents && commit.parents.length > 0 && (
            <div className='mt-4 text-sm'>
              <span className='text-muted-foreground'>
                {commit.parents.length > 1 ? (
                  <Trans>Parents:</Trans>
                ) : (
                  <Trans>Parent:</Trans>
                )}
              </span>
              {commit.parents.map((parent) => (
                <Link
                  key={parent}
                  to='/$repoId/commit/$sha'
                  params={{ repoId: fingerprint, sha: parent }}
                  className='text-primary ms-2 font-mono hover:underline'
                >
                  {parent.substring(0, 7)}
                </Link>
              ))}
            </div>
          )}

          {commit.stats && (
            <div className='mt-4 flex items-center gap-4 text-sm'>
              <span>
                {plural(commit.stats.files, {
                  one: '1 file changed',
                  other: '# files changed',
                })}
              </span>
              <span className='text-success'>+{commit.stats.additions}</span>
              <span className='text-destructive'>
                -{commit.stats.deletions}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {commit.diff && (
        <Card>
          <CardHeader>
            <CardTitle className='text-lg'>
              <Trans>Changes</Trans>
            </CardTitle>
          </CardHeader>
          <CardContent className='p-0'>
            <pre className='overflow-x-auto p-4 font-mono text-sm'>
              {commit.diff.split('\n').map((line, index) => (
                <div
                  key={index}
                  className={
                    line.startsWith('+') && !line.startsWith('+++')
                      ? 'bg-success/10 text-success'
                      : line.startsWith('-') && !line.startsWith('---')
                        ? 'bg-destructive/10 text-destructive'
                        : line.startsWith('@@')
                          ? 'bg-primary/10 text-primary'
                          : ''
                  }
                >
                  {line}
                </div>
              ))}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
