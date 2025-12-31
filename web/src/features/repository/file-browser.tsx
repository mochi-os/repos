import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Card,
  CardContent,
  CardDescription,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '@mochi/common'
import {
  File,
  Folder,
  FolderGit2,
  GitBranch,
  History,
  Tag,
  ChevronRight,
  Settings,
  Copy,
  Check,
} from 'lucide-react'
import { useTree, useBranches } from '@/hooks/use-repository'
import type { TreeEntry } from '@/api/types'

interface FileBrowserProps {
  repoId: string
  name: string
  defaultBranch: string
  description?: string
  initialRef?: string
  initialPath?: string
}

export function FileBrowser({
  repoId,
  name,
  defaultBranch,
  description,
  initialRef,
  initialPath = '',
}: FileBrowserProps) {
  const [currentRef, setCurrentRef] = useState(initialRef || defaultBranch)
  const [copied, setCopied] = useState(false)

  const { data: branchesData } = useBranches(repoId)
  const { data: treeData, isLoading: treeLoading, error } = useTree(repoId, currentRef, initialPath)

  const branches = branchesData?.branches || []
  const entries = treeData?.entries || []

  // Sort entries: directories first, then files
  const sortedEntries = [...entries].sort((a, b) => {
    if (a.type === 'tree' && b.type !== 'tree') return -1
    if (a.type !== 'tree' && b.type === 'tree') return 1
    return a.name.localeCompare(b.name)
  })

  const pathParts = initialPath ? initialPath.split('/').filter(Boolean) : []

  const handleCopyCloneUrl = () => {
    const url = `${window.location.origin}${window.location.pathname}/git`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4 p-4">
      {/* Title row with name and action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <FolderGit2 className="h-5 w-5" />
          <h1 className="text-xl font-semibold">{name}</h1>
        </div>

        <div className="flex-1" />

        <Button variant="outline" size="sm" asChild>
          <Link to="/$repoId/commits" params={{ repoId }}>
            <History className="h-4 w-4 mr-1" />
            Commits
          </Link>
        </Button>

        <Button variant="outline" size="sm" asChild>
          <Link to="/$repoId/branches" params={{ repoId }}>
            <GitBranch className="h-4 w-4 mr-1" />
            Branches
          </Link>
        </Button>

        <Button variant="outline" size="sm" asChild>
          <Link to="/$repoId/tags" params={{ repoId }}>
            <Tag className="h-4 w-4 mr-1" />
            Tags
          </Link>
        </Button>

        <Button variant="outline" size="sm" asChild>
          <Link to="/$repoId/settings" params={{ repoId }}>
            <Settings className="h-4 w-4 mr-1" />
            Settings
          </Link>
        </Button>
      </div>

      {/* Repository description */}
      {description && (
        <CardDescription className="text-base">{description}</CardDescription>
      )}

      {/* Branch selector - only show if there are branches */}
      {branches.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={currentRef} onValueChange={setCurrentRef}>
            <SelectTrigger className="w-[180px]">
              <GitBranch className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Select branch" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((branch) => (
                <SelectItem key={branch.name} value={branch.name}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Clone URL */}
      <div className="flex items-center gap-2 p-2 bg-muted rounded-md font-mono text-sm">
        <code className="flex-1 truncate">
          git clone {window.location.origin}{window.location.pathname}/git
        </code>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopyCloneUrl}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>

      {/* Breadcrumb */}
      {pathParts.length > 0 && (
        <div className="flex items-center gap-1 text-sm">
          <Link to="/" className="text-primary hover:underline">
            {repoId}
          </Link>
          {pathParts.map((part, index) => {
            const pathTo = pathParts.slice(0, index + 1).join('/')
            return (
              <span key={pathTo} className="flex items-center gap-1">
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                {index === pathParts.length - 1 ? (
                  <span>{part}</span>
                ) : (
                  <Link
                    to={`/tree/${currentRef}/${pathTo}` as any}
                    className="text-primary hover:underline"
                  >
                    {part}
                  </Link>
                )}
              </span>
            )
          })}
        </div>
      )}

      {/* File listing */}
      <Card>
        <CardContent className="p-0">
          {treeLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-4 text-destructive">
              {error instanceof Error ? error.message : 'Failed to load files'}
            </div>
          ) : sortedEntries.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Empty repository
            </div>
          ) : (
            <div className="divide-y">
              {sortedEntries.map((entry) => (
                <FileEntry
                  key={entry.name}
                  entry={entry}
                  currentRef={currentRef}
                  basePath={initialPath}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

interface FileEntryProps {
  entry: TreeEntry
  currentRef: string
  basePath: string
}

function FileEntry({ entry, currentRef, basePath }: FileEntryProps) {
  const fullPath = basePath ? `${basePath}/${entry.name}` : entry.name
  const isDirectory = entry.type === 'tree'

  const linkTo = isDirectory
    ? `/tree/${currentRef}/${fullPath}`
    : `/blob/${currentRef}/${fullPath}`

  return (
    <Link
      to={linkTo as any}
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

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}
