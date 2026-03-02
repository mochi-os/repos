import { Link } from '@tanstack/react-router'
import { File, Folder } from 'lucide-react'
import { formatFileSize } from '@/lib/format'
import type { TreeEntry } from '@/api/types'

interface FileEntryProps {
  entry: TreeEntry
  fingerprint: string
  currentRef: string
  basePath: string
}

export function FileEntry({ entry, fingerprint, currentRef, basePath }: FileEntryProps) {
  const fullPath = basePath ? `${basePath}/${entry.name}` : entry.name
  const isDirectory = entry.type === 'tree' || entry.type === 'dir'

  return (
    <Link
      to={isDirectory ? "/$repoId/tree/$ref/$" : "/$repoId/blob/$ref/$"}
      params={{ repoId: fingerprint, ref: currentRef, _splat: fullPath }}
      className="flex items-center gap-3 px-4 py-2 hover:bg-accent transition-colors"
    >
      {isDirectory ? (
        <Folder className="h-4 w-4 text-blue-500" />
      ) : (
        <File className="h-4 w-4 text-muted-foreground" />
      )}
      <span className="flex-1 truncate">{entry.name}</span>
      {entry.size !== undefined && entry.size > 0 && (
        <span className="text-sm text-muted-foreground">
          {formatFileSize(entry.size)}
        </span>
      )}
    </Link>
  )
}
