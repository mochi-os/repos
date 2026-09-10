// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { Link } from '@tanstack/react-router'
import { useFormat } from '@mochi/web'
import { File, Folder } from 'lucide-react'
import type { TreeEntry } from '@/api/types'

interface FileEntryProps {
  entry: TreeEntry
  fingerprint: string
  currentRef: string
  basePath: string
}

export function FileEntry({
  entry,
  fingerprint,
  currentRef,
  basePath,
}: FileEntryProps) {
  const { formatFileSize } = useFormat()
  const fullPath = basePath ? `${basePath}/${entry.name}` : entry.name
  const isDirectory = entry.type === 'tree' || entry.type === 'dir'

  return (
    <Link
      preload={false}
      to={isDirectory ? '/$repoId/tree/$ref/$' : '/$repoId/blob/$ref/$'}
      params={{ repoId: fingerprint, ref: currentRef, _splat: fullPath }}
      className='hover:bg-hover flex items-center gap-3 px-4 py-2 transition-colors'
    >
      {isDirectory ? (
        <Folder className='text-primary h-4 w-4' />
      ) : (
        <File className='text-muted-foreground h-4 w-4' />
      )}
      <span className='flex-1 truncate'>{entry.name}</span>
      {entry.size !== undefined && entry.size > 0 && (
        <span className='text-muted-foreground text-sm'>
          {formatFileSize(entry.size)}
        </span>
      )}
    </Link>
  )
}
