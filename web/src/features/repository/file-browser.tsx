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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  requestHelpers,
  getErrorMessage,
  toast,
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
  Loader2,
  Terminal,
} from 'lucide-react'
import { useTree, useBranches } from '@/hooks/use-repository'
import type { TreeEntry } from '@/api/types'

interface TokenCreateResponse {
  token: string
}

interface CloneDialogProps {
  repoName: string
  fingerprint: string
}

function CloneDialog({ repoName, fingerprint }: CloneDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [cloneCommand, setCloneCommand] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleOpen = async (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen && !cloneCommand) {
      setIsLoading(true)
      try {
        const response = await requestHelpers.post<TokenCreateResponse>(
          '/settings/user/account/token/create',
          { name: repoName }
        )
        const token = response.token
        // Build clone URL based on current location (preserves /repositories/ prefix in class context)
        const pathname = window.location.pathname
        const match = pathname.match(/^(\/[^/]+)\//)
        const appPrefix = match ? match[1] : ''
        const cloneUrl = `${window.location.origin}${appPrefix}/${fingerprint}/git`
        // Parse the URL to insert token as password (server expects token in password field)
        const url = new URL(cloneUrl)
        url.username = 'x'
        url.password = token
        setCloneCommand(`git clone ${url.toString()}`)
      } catch (error) {
        toast.error(getErrorMessage(error, 'Failed to create token'))
        setOpen(false)
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleCopy = () => {
    if (cloneCommand) {
      navigator.clipboard.writeText(cloneCommand)
      setCopied(true)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleClose = () => {
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Terminal className="h-4 w-4 mr-1" />
          Clone
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clone repository</DialogTitle>
          <DialogDescription>
            Copy this command to clone the repository. A token has been created for authentication.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : cloneCommand ? (
          <div className="space-y-4">
            <div className="bg-muted flex items-center gap-2 rounded-md p-3 font-mono text-sm">
              <code className="flex-1 break-all select-all">{cloneCommand}</code>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

interface FileBrowserProps {
  repoId: string
  fingerprint: string
  name: string
  defaultBranch: string
  description?: string
  initialRef?: string
  initialPath?: string
}

export function FileBrowser({
  repoId,
  fingerprint,
  name,
  defaultBranch,
  description,
  initialRef,
  initialPath = '',
}: FileBrowserProps) {
  const [currentRef, setCurrentRef] = useState(initialRef || defaultBranch)

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
          <Link to="/$repoId/commits" params={{ repoId: fingerprint }}>
            <History className="h-4 w-4 mr-1" />
            Commits
          </Link>
        </Button>

        <Button variant="outline" size="sm" asChild>
          <Link to="/$repoId/branches" params={{ repoId: fingerprint }}>
            <GitBranch className="h-4 w-4 mr-1" />
            Branches
          </Link>
        </Button>

        <Button variant="outline" size="sm" asChild>
          <Link to="/$repoId/tags" params={{ repoId: fingerprint }}>
            <Tag className="h-4 w-4 mr-1" />
            Tags
          </Link>
        </Button>

        <Button variant="outline" size="sm" asChild>
          <Link to="/$repoId/settings" params={{ repoId: fingerprint }}>
            <Settings className="h-4 w-4 mr-1" />
            Settings
          </Link>
        </Button>

        <CloneDialog repoName={name} fingerprint={fingerprint} />
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

      {/* Breadcrumb */}
      {pathParts.length > 0 && (
        <div className="flex items-center gap-1 text-sm">
          <Link
            to="/$repoId/tree/$ref/$"
            params={{ repoId: fingerprint, ref: currentRef, _splat: '' }}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            {name}
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
                    to="/$repoId/tree/$ref/$"
                    params={{ repoId: fingerprint, ref: currentRef, _splat: pathTo }}
                    className="text-blue-600 dark:text-blue-400 hover:underline"
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
              {getErrorMessage(error, 'Failed to load files')}
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
                  fingerprint={fingerprint}
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
  fingerprint: string
  currentRef: string
  basePath: string
}

function FileEntry({ entry, fingerprint, currentRef, basePath }: FileEntryProps) {
  const fullPath = basePath ? `${basePath}/${entry.name}` : entry.name
  const isDirectory = entry.type === 'tree'

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

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

// FileTree: Simplified file browser without header (for use with RepositoryNav)
interface FileTreeProps {
  repoId: string
  fingerprint: string
  name: string
  defaultBranch: string
  currentRef: string
  currentPath: string
}

export function FileTree({
  repoId,
  fingerprint,
  name,
  defaultBranch,
  currentRef: initialRef,
  currentPath,
}: FileTreeProps) {
  const [currentRef, setCurrentRef] = useState(initialRef || defaultBranch)

  const { data: branchesData } = useBranches(repoId)
  const { data: treeData, isLoading: treeLoading, error } = useTree(repoId, currentRef, currentPath)

  const branches = branchesData?.branches || []
  const entries = treeData?.entries || []

  const sortedEntries = [...entries].sort((a, b) => {
    if (a.type === 'tree' && b.type !== 'tree') return -1
    if (a.type !== 'tree' && b.type === 'tree') return 1
    return a.name.localeCompare(b.name)
  })

  const pathParts = currentPath ? currentPath.split('/').filter(Boolean) : []

  return (
    <div className="space-y-4">
      {/* Branch selector */}
      {branches.length > 0 && (
        <Select value={currentRef} onValueChange={setCurrentRef}>
          <SelectTrigger className="w-[180px]">
            <GitBranch className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Select branch" />
          </SelectTrigger>
          <SelectContent>
            {/* Show current ref if not in branches list (e.g., tag or invalid ref) */}
            {!branches.some(b => b.name === currentRef) && (
              <SelectItem value={currentRef} disabled>
                {currentRef}
              </SelectItem>
            )}
            {branches.map((branch) => (
              <SelectItem key={branch.name} value={branch.name}>
                {branch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Breadcrumb */}
      {pathParts.length > 0 && (
        <div className="flex items-center gap-1 text-sm">
          <Link
            to="/$repoId/tree/$ref/$"
            params={{ repoId: fingerprint, ref: currentRef, _splat: '' }}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            {name}
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
                    to="/$repoId/tree/$ref/$"
                    params={{ repoId: fingerprint, ref: currentRef, _splat: pathTo }}
                    className="text-blue-600 dark:text-blue-400 hover:underline"
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
              {getErrorMessage(error, 'Failed to load files')}
            </div>
          ) : sortedEntries.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Empty directory
            </div>
          ) : (
            <div className="divide-y">
              {sortedEntries.map((entry) => (
                <FileEntry
                  key={entry.name}
                  entry={entry}
                  fingerprint={fingerprint}
                  currentRef={currentRef}
                  basePath={currentPath}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
