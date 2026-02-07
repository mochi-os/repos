import { useState, useCallback, useEffect } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Card,
  CardContent,
  CardDescription,
  Badge,
  Button,
  Label,
  Textarea,
  Skeleton,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  cn,
  toast,
  getErrorMessage,
  AccessDialog,
  AccessList,
  type AccessLevel,
  type AccessRule,
} from '@mochi/common'
import {
  Check,
  ChevronRight,
  File,
  FolderGit2,
  Folder,
  GitBranch,
  GitCommit,
  History,
  Loader2,
  Pencil,
  Plus,
  Save,
  Settings,
  Shield,
  Tag,
  Trash2,
  User,
  UserMinus,
  X,
} from 'lucide-react'
import { useTree, useBranches, useTags, useCommits, useCreateBranch, useDeleteBranch, repoKeys } from '@/hooks/use-repository'
import { reposRequest } from '@/api/request'
import endpoints from '@/api/endpoints'
import type { TreeEntry } from '@/api/types'

// Re-export CloneDialog from shared component
export { CloneDialog } from '@/components/clone-dialog'

export type RepositoryTabId = 'files' | 'commits' | 'branches' | 'tags' | 'settings' | 'access'

interface Tab {
  id: RepositoryTabId
  label: string
  icon: React.ReactNode
  ownerOnly?: boolean
}

const tabs: Tab[] = [
  { id: 'files', label: 'Files', icon: <FolderGit2 className="h-4 w-4" /> },
  { id: 'commits', label: 'Commits', icon: <History className="h-4 w-4" /> },
  { id: 'branches', label: 'Branches', icon: <GitBranch className="h-4 w-4" /> },
  { id: 'tags', label: 'Tags', icon: <Tag className="h-4 w-4" /> },
  { id: 'access', label: 'Access', icon: <Shield className="h-4 w-4" />, ownerOnly: true },
  { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" />, ownerOnly: true },
]

interface RepositoryTabsProps {
  repoId: string
  fingerprint: string
  name: string
  defaultBranch: string
  description?: string
  isOwner?: boolean
  activeTab: RepositoryTabId
  onTabChange: (tab: RepositoryTabId) => void
}

export function RepositoryTabs({
  repoId,
  fingerprint,
  name,
  defaultBranch,
  description,
  isOwner,
  activeTab,
  onTabChange,
}: RepositoryTabsProps) {

  // Filter tabs based on ownership
  const visibleTabs = tabs.filter(tab => !tab.ownerOnly || isOwner)

  return (
    <div className="space-y-4">
      {description && (
        <CardDescription className="text-base">{description}</CardDescription>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors',
              'border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'files' && (
          <FilesTab
            repoId={repoId}
            fingerprint={fingerprint}
            name={name}
            defaultBranch={defaultBranch}
          />
        )}
        {activeTab === 'commits' && <CommitsTab repoId={repoId} fingerprint={fingerprint} />}
        {activeTab === 'branches' && (
          <BranchesTab
            repoId={repoId}
            fingerprint={fingerprint}
            defaultBranch={defaultBranch}
            isOwner={isOwner}
          />
        )}
        {activeTab === 'tags' && <TagsTab repoId={repoId} fingerprint={fingerprint} />}
        {activeTab === 'settings' && isOwner && (
          <GeneralSettingsTab
            repoId={repoId}
            fingerprint={fingerprint}
            name={name}
            description={description}
            defaultBranch={defaultBranch}
          />
        )}
        {activeTab === 'access' && isOwner && (
          <AccessSettingsTab repoId={repoId} />
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Unsubscribe Button
// ============================================================================

export function UnsubscribeButton({ repoId, repoName }: { repoId: string; repoName: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showDialog, setShowDialog] = useState(false)
  const [isUnsubscribing, setIsUnsubscribing] = useState(false)

  const handleUnsubscribe = async () => {
    setIsUnsubscribing(true)
    try {
      await reposRequest.post('unsubscribe', { repository: repoId }, { baseURL: '/repositories/' })
      toast.success('Unsubscribed from repository')
      // Invalidate repository list to refresh sidebar
      queryClient.invalidateQueries({ queryKey: repoKeys.info() })
      void navigate({ to: '/' })
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to unsubscribe'))
    } finally {
      setIsUnsubscribing(false)
      setShowDialog(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowDialog(true)}
        disabled={isUnsubscribing}
      >
        <UserMinus className="h-4 w-4 mr-1" />
        Unsubscribe
      </Button>
      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsubscribe from repository?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove "{repoName}" from your repository list. You can subscribe again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnsubscribe} disabled={isUnsubscribing}>
              {isUnsubscribing ? 'Unsubscribing...' : 'Unsubscribe'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ============================================================================
// Files Tab
// ============================================================================

interface FilesTabProps {
  repoId: string
  fingerprint: string
  name: string
  defaultBranch: string
  initialRef?: string
  initialPath?: string
}

function FilesTab({
  repoId,
  fingerprint,
  name,
  defaultBranch,
  initialRef,
  initialPath = '',
}: FilesTabProps) {
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
    <div className="space-y-4">
      {/* Branch selector */}
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
          <Link to="/$repoId" params={{ repoId: fingerprint }} className="text-blue-600 dark:text-blue-400 hover:underline">
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

// ============================================================================
// Commits Tab
// ============================================================================

function CommitsTab({ repoId, fingerprint }: { repoId: string; fingerprint: string }) {
  const { data, isLoading, error } = useCommits(repoId)

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(10)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">
        {getErrorMessage(error, 'Failed to load commits')}
      </div>
    )
  }

  const commits = data?.commits || []

  if (commits.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <GitCommit className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No commits yet</p>
      </div>
    )
  }

  return (
    <Card>
      <CardContent className="p-0 divide-y">
        {commits.map((commit) => (
          <Link
            key={commit.sha}
            to="/$repoId/commit/$sha"
            params={{ repoId: fingerprint, sha: commit.sha }}
            className="flex items-start gap-4 p-4 hover:bg-accent transition-colors"
          >
            <GitCommit className="h-5 w-5 mt-0.5 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{getCommitTitle(commit.message)}</div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <User className="h-3 w-3" />
                <span>{commit.author}</span>
                <span>·</span>
                <span>{formatDate(commit.date)}</span>
              </div>
            </div>
            <code className="text-sm text-muted-foreground font-mono flex-shrink-0">
              {commit.sha.substring(0, 7)}
            </code>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Branches Tab
// ============================================================================

interface BranchesTabProps {
  repoId: string
  fingerprint: string
  defaultBranch: string
  isOwner?: boolean
}

function BranchesTab({ repoId, fingerprint, defaultBranch, isOwner }: BranchesTabProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [branchToDelete, setBranchToDelete] = useState('')
  const [newBranchName, setNewBranchName] = useState('')
  const [sourceBranch, setSourceBranch] = useState('')

  const { data, isLoading, error } = useBranches(repoId)
  const createBranch = useCreateBranch(repoId)
  const deleteBranch = useDeleteBranch(repoId)

  const branches = data?.branches || []
  const actualDefault = data?.default || defaultBranch

  const handleCreate = () => {
    if (!newBranchName.trim()) {
      toast.error('Branch name is required')
      return
    }
    createBranch.mutate(
      { name: newBranchName.trim(), source: sourceBranch || actualDefault },
      {
        onSuccess: () => {
          toast.success(`Branch "${newBranchName}" created`)
          setShowCreateDialog(false)
          setNewBranchName('')
          setSourceBranch('')
        },
        onError: (err) => {
          toast.error(getErrorMessage(err, 'Failed to create branch'))
        },
      }
    )
  }

  const handleDeleteClick = (name: string) => {
    setBranchToDelete(name)
    setShowDeleteDialog(true)
  }

  const handleDelete = () => {
    deleteBranch.mutate(branchToDelete, {
      onSuccess: () => {
        toast.success(`Branch "${branchToDelete}" deleted`)
        setShowDeleteDialog(false)
        setBranchToDelete('')
      },
      onError: (err) => {
        toast.error(getErrorMessage(err, 'Failed to delete branch'))
      },
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">
        {getErrorMessage(error, 'Failed to load branches')}
      </div>
    )
  }

  return (
    <>
      {isOwner && (
        <div className="flex justify-end mb-4">
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4" />
            Create branch
          </Button>
        </div>
      )}

      {branches.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No branches yet</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {branches.map((branch) => (
              <div
                key={branch.name}
                className="flex items-center gap-4 p-4 hover:bg-accent transition-colors"
              >
                <Link
                  to="/$repoId/tree/$ref/$"
                  params={{ repoId: fingerprint, ref: branch.name, _splat: '' }}
                  className="flex items-center gap-4 flex-1 min-w-0"
                >
                  <GitBranch className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{branch.name}</span>
                      {branch.name === actualDefault && (
                        <Badge variant="secondary">default</Badge>
                      )}
                    </div>
                  </div>
                  <code className="text-sm text-muted-foreground font-mono flex-shrink-0">
                    {branch.sha.substring(0, 7)}
                  </code>
                </Link>
                {isOwner && branch.name !== actualDefault && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.preventDefault()
                      handleDeleteClick(branch.name)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Create branch dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New branch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="branch-name">Branch name</Label>
              <Input
                id="branch-name"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="feature/my-feature"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Source branch</Label>
              <Select value={sourceBranch || actualDefault} onValueChange={setSourceBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.name} value={b.name}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!newBranchName.trim() || createBranch.isPending}>
              {createBranch.isPending ? 'Creating...' : <><Plus className="h-4 w-4 mr-2" />Create branch</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete branch?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete "{branchToDelete}"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteBranch.isPending}>
              {deleteBranch.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ============================================================================
// Tags Tab
// ============================================================================

function TagsTab({ repoId, fingerprint }: { repoId: string; fingerprint: string }) {
  const { data, isLoading, error } = useTags(repoId)

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">
        {getErrorMessage(error, 'Failed to load tags')}
      </div>
    )
  }

  const tags = data?.tags || []

  if (tags.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No tags yet</p>
      </div>
    )
  }

  return (
    <Card>
      <CardContent className="p-0 divide-y">
        {tags.map((tag) => (
          <Link
            key={tag.name}
            to="/$repoId/tree/$ref/$"
            params={{ repoId: fingerprint, ref: tag.name, _splat: '' }}
            className="flex items-center gap-4 p-4 hover:bg-accent transition-colors"
          >
            <Tag className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium">{tag.name}</div>
              {tag.message && (
                <div className="text-sm text-muted-foreground truncate">
                  {tag.message}
                </div>
              )}
              {tag.tagger && tag.date && (
                <div className="text-sm text-muted-foreground">
                  {tag.tagger} tagged on {formatTagDate(tag.date)}
                </div>
              )}
            </div>
            <code className="text-sm text-muted-foreground font-mono flex-shrink-0">
              {tag.sha.substring(0, 7)}
            </code>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Settings Tab
// ============================================================================

const REPO_ACCESS_LEVELS: AccessLevel[] = [
  { value: 'write', label: 'Read and write' },
  { value: 'read', label: 'Read only' },
  { value: 'none', label: 'No access' },
]

interface GeneralSettingsTabProps {
  repoId: string
  fingerprint: string
  name: string
  description?: string
  defaultBranch: string
}

// Characters disallowed in repository names (matches backend validation)
const DISALLOWED_NAME_CHARS = /[<>\r\n\\;"'`]/

function GeneralSettingsTab({
  repoId,
  fingerprint,
  name: initialName,
  description: initialDescription,
  defaultBranch: initialDefaultBranch,
}: GeneralSettingsTabProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [currentName, setCurrentName] = useState(initialName || '')
  const [description, setDescription] = useState(initialDescription || '')
  const [selectedBranch, setSelectedBranch] = useState(initialDefaultBranch || 'main')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Inline edit state for name
  const [isEditingName, setIsEditingName] = useState(false)
  const [editName, setEditName] = useState(initialName || '')
  const [isRenaming, setIsRenaming] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  const { data: branchesData } = useBranches(repoId)
  const branches = branchesData?.branches || []

  const updateSetting = useMutation({
    mutationFn: (settings: Record<string, string>) =>
      reposRequest.post<{ success: boolean }>(
        endpoints.repo.settingsSet,
        settings,
        { baseURL: `/repositories/${repoId}/-/` }
      ),
    onSuccess: () => {
      toast.success('Settings saved')
      queryClient.invalidateQueries({ queryKey: repoKeys.info() })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to save setting'))
    },
  })

  const deleteRepo = useMutation({
    mutationFn: () =>
      reposRequest.post<{ success: boolean }>(
        endpoints.repo.delete,
        undefined,
        { baseURL: `/repositories/${repoId}/-/` }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: repoKeys.info() })
      toast.success('Repository deleted')
      void navigate({ to: '/' })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to delete repository'))
    },
  })

  const validateName = (n: string): string | null => {
    if (!n.trim()) return 'Repository name is required'
    if (n.length > 100) return 'Name must be 100 characters or less'
    if (DISALLOWED_NAME_CHARS.test(n)) return 'Name cannot contain < > \\ ; " \' or ` characters'
    return null
  }

  const handleStartEditName = () => {
    setEditName(currentName || '')
    setNameError(null)
    setIsEditingName(true)
  }

  const handleCancelEditName = () => {
    setIsEditingName(false)
    setEditName(currentName || '')
    setNameError(null)
  }

  const handleSaveEditName = async () => {
    const trimmedName = editName.trim()
    const error = validateName(trimmedName)
    if (error) {
      setNameError(error)
      return
    }
    if (trimmedName === currentName) {
      setIsEditingName(false)
      return
    }
    setIsRenaming(true)
    try {
      await reposRequest.post<{ success: boolean }>(
        endpoints.repo.rename,
        { name: trimmedName },
        { baseURL: `/repositories/${repoId}/-/` }
      )
      setCurrentName(trimmedName)
      toast.success('Repository renamed')
      queryClient.invalidateQueries({ queryKey: repoKeys.info() })
      setIsEditingName(false)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to rename repository'))
    } finally {
      setIsRenaming(false)
    }
  }

  const handleBranchChange = (value: string) => {
    setSelectedBranch(value)
    updateSetting.mutate({ default_branch: value })
  }

  const handleDelete = () => {
    deleteRepo.mutate()
  }

  return (
    <div className="max-w-2xl divide-y">
      <div className="py-4">
        <h3 className="text-lg font-semibold mb-4">Identity</h3>
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 items-center">
          <span className="text-muted-foreground">Name:</span>
          {isEditingName ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Input
                  value={editName}
                  onChange={(e) => {
                    setEditName(e.target.value)
                    setNameError(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSaveEditName()
                    if (e.key === 'Escape') handleCancelEditName()
                  }}
                  className="h-8"
                  disabled={isRenaming}
                  autoFocus
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void handleSaveEditName()}
                  disabled={isRenaming}
                  className="h-8 w-8 p-0"
                >
                  {isRenaming ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCancelEditName}
                  disabled={isRenaming}
                  className="h-8 w-8 p-0"
                >
                  <X className="size-4" />
                </Button>
              </div>
              {nameError && (
                <span className="text-sm text-destructive">{nameError}</span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span>{currentName}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleStartEditName}
                className="h-6 w-6 p-0"
              >
                <Pencil className="size-3" />
              </Button>
            </div>
          )}
          <span className="text-muted-foreground">Entity:</span>
          <span className="font-mono break-all text-xs">{repoId}</span>
          <span className="text-muted-foreground">Fingerprint:</span>
          <span className="font-mono break-all text-xs">
            {fingerprint.match(/.{1,3}/g)?.join('-')}
          </span>
        </div>
      </div>

      <div className="space-y-2 py-4">
        <Label className="text-base">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
        <Button
          size="sm"
          onClick={() => updateSetting.mutate({ description })}
          disabled={updateSetting.isPending || description === (initialDescription || '')}
        >
          <Save className="h-4 w-4" />
          Save
        </Button>
      </div>

      {branches.length > 0 && (
        <div className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <Label className="text-base">Default branch</Label>
            <p className="text-sm text-muted-foreground">The branch shown when viewing the repository</p>
          </div>
          <div className="w-full sm:w-48">
            <Select
              value={selectedBranch}
              onValueChange={handleBranchChange}
              disabled={updateSetting.isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select default branch" />
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
        </div>
      )}

      <div className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <Label className="text-base">Delete repository</Label>
          <p className="text-sm text-muted-foreground">
            Permanently delete this repository and all its data
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowDeleteDialog(true)}
          disabled={deleteRepo.isPending}
        >
          <Trash2 className="h-4 w-4" />
          Delete repository
        </Button>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete repository?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{currentName}" and all its commits, branches, and
              tags. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function AccessSettingsTab({ repoId }: { repoId: string }) {
  const [rules, setRules] = useState<AccessRule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [userSearchQuery, setUserSearchQuery] = useState('')

  // User search - use class-level endpoint
  const { data: userSearchData, isLoading: userSearchLoading } = useQuery({
    queryKey: ['users', 'search', userSearchQuery],
    queryFn: () => reposRequest.get<{ results: Array<{ id: string; name: string }> }>(
      `${endpoints.users.search}?q=${encodeURIComponent(userSearchQuery)}`,
      { baseURL: '/repositories/' }
    ),
    enabled: userSearchQuery.length >= 1,
  })

  // Groups - use class-level endpoint
  const { data: groupsData } = useQuery({
    queryKey: ['groups', 'list'],
    queryFn: () => reposRequest.get<{ groups: Array<{ id: string; name: string }> }>(
      endpoints.groups.list,
      { baseURL: '/repositories/' }
    ),
  })

  const loadRules = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await reposRequest.get<{ rules: AccessRule[] }>(
        endpoints.repo.access,
        { baseURL: `/repositories/${repoId}/-/` }
      )
      setRules(response.rules ?? [])
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load access rules'))
    } finally {
      setIsLoading(false)
    }
  }, [repoId])

  useEffect(() => {
    void loadRules()
  }, [loadRules])

  const handleAdd = async (subject: string, subjectName: string, operation: string) => {
    try {
      await reposRequest.post(
        endpoints.repo.accessSet,
        { subject, permission: operation },
        { baseURL: `/repositories/${repoId}/-/` }
      )
      toast.success(`Access set for ${subjectName}`)
      void loadRules()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to set access level'))
      throw err
    }
  }

  const handleRevoke = async (subject: string) => {
    try {
      await reposRequest.post(
        endpoints.repo.accessRevoke,
        { subject },
        { baseURL: `/repositories/${repoId}/-/` }
      )
      toast.success('Access removed')
      void loadRules()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to remove access'))
    }
  }

  const handleLevelChange = async (subject: string, operation: string) => {
    try {
      await reposRequest.post(
        endpoints.repo.accessSet,
        { subject, permission: operation },
        { baseURL: `/repositories/${repoId}/-/` }
      )
      toast.success('Access level updated')
      void loadRules()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update access level'))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      <AccessDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onAdd={handleAdd}
        levels={REPO_ACCESS_LEVELS}
        defaultLevel="read"
        userSearchResults={userSearchData?.results ?? []}
        userSearchLoading={userSearchLoading}
        onUserSearch={setUserSearchQuery}
        groups={groupsData?.groups ?? []}
      />

      <AccessList
        rules={rules}
        levels={REPO_ACCESS_LEVELS}
        onLevelChange={handleLevelChange}
        onRevoke={handleRevoke}
        isLoading={isLoading}
        error={error}
      />
    </div>
  )
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function getCommitTitle(message: string): string {
  const firstLine = message.split('\n')[0]
  return firstLine.length > 72 ? firstLine.substring(0, 69) + '...' : firstLine
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60))
      return diffMinutes <= 1 ? 'just now' : `${diffMinutes} minutes ago`
    }
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`
  }

  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`

  return date.toLocaleDateString()
}

function formatTagDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString()
}
