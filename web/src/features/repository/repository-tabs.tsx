// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { useState, useCallback, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  CardDescription,
  Button,
  Label,
  Textarea,
  Select,
  Switch,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Tabs,
  TabsList,
  TabsTrigger,
  toastAction,
  getErrorMessage,
  AccessDialog,
  AccessList,
  DataChip,
  type AccessLevel,
  type AccessRule,
} from '@mochi/web'
import {
  Check,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UserMinus,
  X,
} from 'lucide-react'
import endpoints from '@/api/endpoints'
import { reposRequest, appBasePath, repoBasePath } from '@/api/request'
import { DISALLOWED_NAME_CHARS, isValidPath } from '@/lib/validation'
import {
  useTree,
  useBranches,
  useUnsubscribe,
  repoKeys,
} from '@/hooks/use-repository'
import { RefSelector } from '@/components/ref-selector'
import { BranchesList } from './branches-list'
import { CommitsList } from './commits-list'
import { FileListing } from './file-browser'
import { useRepositoryTabs, type RepositoryTabId } from './tabs'
import { TagsList } from './tags-list'

// Re-export CloneDialog from shared component
export { CloneDialog } from '@/components/clone-dialog'
export type { RepositoryTabId }

interface RepositoryTabsProps {
  repoId: string
  fingerprint: string
  name: string
  path: string
  defaultBranch: string
  description?: string
  allowRead?: boolean
  privacy?: string
  isOwner?: boolean
  activeTab: RepositoryTabId
  onTabChange: (tab: RepositoryTabId) => void
}

const tabsWithBranchSelector = new Set<RepositoryTabId>(['files', 'commits'])

export function RepositoryTabs({
  repoId,
  fingerprint,
  name,
  path,
  defaultBranch,
  description,
  allowRead,
  privacy,
  isOwner,
  activeTab,
  onTabChange,
}: RepositoryTabsProps) {
  const [currentRef, setCurrentRef] = useState(defaultBranch)
  const { data: branchesData } = useBranches(repoId)
  const branches = branchesData?.branches || []

  // Filter tabs based on ownership
  const tabs = useRepositoryTabs()
  const visibleTabs = tabs.filter((tab) => !tab.ownerOnly || isOwner)

  return (
    <div className='space-y-4'>
      {description && (
        <CardDescription className='text-base'>{description}</CardDescription>
      )}

      {/* Tab bar */}
      <Tabs
        variant='underline'
        value={activeTab}
        onValueChange={(value) => onTabChange(value as typeof activeTab)}
      >
        <TabsList>
          {visibleTabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className='gap-2'>
              {tab.icon}
              <span className='hidden sm:inline'>{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Branch selector - shared across files/commits tabs */}
      {tabsWithBranchSelector.has(activeTab) && branches.length > 0 && (
        <RefSelector
          branches={branches}
          value={currentRef}
          onValueChange={setCurrentRef}
        />
      )}

      {/* Tab content */}
      <div className='pt-2'>
        {activeTab === 'files' && (
          <FilesTab
            repoId={repoId}
            fingerprint={fingerprint}
            currentRef={currentRef}
          />
        )}
        {activeTab === 'commits' && (
          <CommitsList
            repoId={repoId}
            fingerprint={fingerprint}
            currentRef={currentRef}
          />
        )}
        {activeTab === 'branches' && (
          <BranchesList
            repoId={repoId}
            fingerprint={fingerprint}
            defaultBranch={defaultBranch}
            canManage={isOwner}
          />
        )}
        {activeTab === 'tags' && (
          <TagsList repoId={repoId} fingerprint={fingerprint} />
        )}
        {activeTab === 'settings' && isOwner && (
          <GeneralSettingsTab
            repoId={repoId}
            fingerprint={fingerprint}
            name={name}
            path={path}
            description={description}
            defaultBranch={defaultBranch}
            allowRead={allowRead}
            privacy={privacy}
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

export function UnsubscribeButton({
  repoId,
  repoName,
}: {
  repoId: string
  repoName: string
}) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const unsubscribe = useUnsubscribe()
  const [showDialog, setShowDialog] = useState(false)
  const [isUnsubscribing, setIsUnsubscribing] = useState(false)

  const handleUnsubscribe = async () => {
    setIsUnsubscribing(true)
    try {
      await toastAction(unsubscribe.mutateAsync(repoId), {
        loading: t`Unsubscribing...`,
        success: t`Unsubscribed from repository`,
        error: (e) => getErrorMessage(e, t`Failed to unsubscribe`),
      })
      void navigate({ to: '/' })
    } catch {
      // toast already shown
    } finally {
      setIsUnsubscribing(false)
      setShowDialog(false)
    }
  }

  return (
    <>
      <Button
        variant='outline'
        size='sm'
        onClick={() => setShowDialog(true)}
        disabled={isUnsubscribing}
      >
        <UserMinus className='me-1 h-4 w-4' />
        <Trans>Unsubscribe</Trans>
      </Button>
      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <Trans>Unsubscribe from repository?</Trans>
            </AlertDialogTitle>
            <AlertDialogDescription>
              <Trans>
                This will remove "{repoName}" from your repository list. You can
                subscribe again later.
              </Trans>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Trans>Cancel</Trans>
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnsubscribe}
              disabled={isUnsubscribing}
            >
              {isUnsubscribing ? (
                <Trans>Unsubscribing...</Trans>
              ) : (
                <Trans>Unsubscribe</Trans>
              )}
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

function FilesTab({
  repoId,
  fingerprint,
  currentRef,
}: {
  repoId: string
  fingerprint: string
  currentRef: string
}) {
  const { data, isLoading, error } = useTree(repoId, currentRef, '')
  return (
    <FileListing
      fingerprint={fingerprint}
      currentRef={currentRef}
      currentPath=''
      entries={data?.entries || []}
      isLoading={isLoading}
      error={error}
    />
  )
}

// ============================================================================
// Settings Tab
// ============================================================================

function useRepoAccessLevels(): AccessLevel[] {
  const { t } = useLingui()
  return [
    { value: 'write', label: t`Read and write` },
    { value: 'read', label: t`Read only` },
    { value: 'none', label: t`No access` },
  ]
}

interface GeneralSettingsTabProps {
  repoId: string
  fingerprint: string
  name: string
  path: string
  description?: string
  defaultBranch: string
  allowRead?: boolean
  privacy?: string
}

function GeneralSettingsTab({
  repoId,
  fingerprint,
  name: initialName,
  path: initialPath,
  description: initialDescription,
  defaultBranch: initialDefaultBranch,
  allowRead: initialAllowRead,
  privacy: initialPrivacy,
}: GeneralSettingsTabProps) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [currentName, setCurrentName] = useState(initialName || '')
  const [currentPath, setCurrentPath] = useState(initialPath || '')
  const [description, setDescription] = useState(initialDescription || '')
  const [selectedBranch, setSelectedBranch] = useState(
    initialDefaultBranch || 'main'
  )
  const [allowRead, setAllowRead] = useState(initialAllowRead !== false)
  const [privacy, setPrivacy] = useState(initialPrivacy !== 'private')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Inline edit state for name
  const [isEditingName, setIsEditingName] = useState(false)
  const [editName, setEditName] = useState(initialName || '')
  const [isRenaming, setIsRenaming] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  // Inline edit state for path
  const [isEditingPath, setIsEditingPath] = useState(false)
  const [editPath, setEditPath] = useState(initialPath || '')
  const [isSavingPath, setIsSavingPath] = useState(false)
  const [pathError, setPathError] = useState<string | null>(null)

  const { data: branchesData } = useBranches(repoId)
  const branches = branchesData?.branches || []

  const updateSetting = useMutation({
    mutationFn: (settings: Record<string, string>) =>
      reposRequest.post<{ success: boolean }>(
        endpoints.repo.settingsSet,
        settings,
        { baseURL: repoBasePath(repoId) }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: repoKeys.info() })
    },
  })

  const deleteRepo = useMutation({
    mutationFn: () =>
      reposRequest.post<{ success: boolean }>(
        endpoints.repo.delete,
        undefined,
        { baseURL: repoBasePath(repoId) }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: repoKeys.info() })
    },
  })

  const validateName = (n: string): string | null => {
    if (!n.trim()) return t`Repository name is required`
    if (n.length > 100) return t`Name must be 100 characters or less`
    if (DISALLOWED_NAME_CHARS.test(n))
      return t`Name cannot contain < or > characters`
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
      await toastAction(
        reposRequest.post<{ success: boolean }>(
          endpoints.repo.rename,
          { name: trimmedName },
          { baseURL: repoBasePath(repoId) }
        ),
        {
          loading: t`Renaming repository...`,
          success: t`Repository renamed`,
          error: (e) => getErrorMessage(e, t`Failed to rename repository`),
        }
      )
      setCurrentName(trimmedName)
      queryClient.invalidateQueries({ queryKey: repoKeys.info() })
      setIsEditingName(false)
    } catch {
      // toast already shown
    } finally {
      setIsRenaming(false)
    }
  }

  const handleStartEditPath = () => {
    setEditPath(currentPath || '')
    setPathError(null)
    setIsEditingPath(true)
  }

  const handleCancelEditPath = () => {
    setIsEditingPath(false)
    setEditPath(currentPath || '')
    setPathError(null)
  }

  const handleSaveEditPath = async () => {
    const trimmedPath = editPath.trim()
    if (!trimmedPath) {
      setPathError(t`Path is required`)
      return
    }
    if (!isValidPath(trimmedPath)) {
      setPathError(t`Lowercase letters, numbers, and hyphens only`)
      return
    }
    if (trimmedPath === currentPath) {
      setIsEditingPath(false)
      return
    }
    setIsSavingPath(true)
    try {
      await toastAction(
        reposRequest.post<{ success: boolean }>(
          endpoints.repo.settingsSet,
          { path: trimmedPath },
          { baseURL: repoBasePath(repoId) }
        ),
        {
          loading: t`Updating path...`,
          success: t`Path updated`,
          error: (e) => getErrorMessage(e, t`Failed to update path`),
        }
      )
      setCurrentPath(trimmedPath)
      queryClient.invalidateQueries({ queryKey: repoKeys.info() })
      setIsEditingPath(false)
    } catch {
      // toast already shown
    } finally {
      setIsSavingPath(false)
    }
  }

  const handleBranchChange = async (value: string) => {
    const previous = selectedBranch
    setSelectedBranch(value)
    try {
      await toastAction(updateSetting.mutateAsync({ default_branch: value }), {
        loading: t`Saving settings...`,
        success: t`Settings saved`,
        error: (e) => getErrorMessage(e, t`Failed to save setting`),
      })
    } catch {
      setSelectedBranch(previous)
    }
  }

  // Both are access-control settings the server reserves for admins, and both
  // were previously settable only at creation: a repository created public
  // could not be made private afterwards.
  const handleAllowReadChange = async (value: boolean) => {
    setAllowRead(value)
    try {
      await toastAction(
        updateSetting.mutateAsync({ allow_read: value ? 'true' : 'false' }),
        {
          loading: t`Saving settings...`,
          success: t`Settings saved`,
          error: (e) => getErrorMessage(e, t`Failed to save setting`),
        }
      )
    } catch {
      setAllowRead(!value)
    }
  }

  const handlePrivacyChange = async (value: boolean) => {
    setPrivacy(value)
    try {
      await toastAction(
        updateSetting.mutateAsync({ privacy: value ? 'public' : 'private' }),
        {
          loading: t`Saving settings...`,
          success: t`Settings saved`,
          error: (e) => getErrorMessage(e, t`Failed to save setting`),
        }
      )
    } catch {
      setPrivacy(!value)
    }
  }

  const handleSaveDescription = async () => {
    try {
      await toastAction(updateSetting.mutateAsync({ description }), {
        loading: t`Saving settings...`,
        success: t`Settings saved`,
        error: (e) => getErrorMessage(e, t`Failed to save setting`),
      })
    } catch {
      // toast already shown
    }
  }

  const handleDelete = async () => {
    try {
      await toastAction(deleteRepo.mutateAsync(), {
        loading: t`Deleting repository...`,
        success: t`Repository deleted`,
        error: (e) => getErrorMessage(e, t`Failed to delete repository`),
      })
      void navigate({ to: '/' })
    } catch {
      // toast already shown
    }
  }

  return (
    <div className='max-w-2xl divide-y'>
      <div className='pb-4'>
        <h3 className='mb-4 text-lg font-semibold'>
          <Trans>Identity</Trans>
        </h3>
        <div className='grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2'>
          <span className='text-muted-foreground'>
            <Trans>Name:</Trans>
          </span>
          {isEditingName ? (
            <div className='flex flex-col gap-1'>
              <div className='flex items-center gap-2'>
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
                  className='h-8'
                  disabled={isRenaming}
                  autoFocus
                />
                <Button
                  size='sm'
                  variant='ghost'
                  onClick={() => void handleSaveEditName()}
                  disabled={isRenaming}
                  className='h-8 w-8 p-0'
                >
                  {isRenaming ? (
                    <Loader2 className='size-4 animate-spin' />
                  ) : (
                    <Check className='size-4' />
                  )}
                </Button>
                <Button
                  size='sm'
                  variant='ghost'
                  onClick={handleCancelEditName}
                  disabled={isRenaming}
                  className='h-8 w-8 p-0'
                  aria-label={t`Cancel edit`}
                >
                  <X className='size-4' />
                </Button>
              </div>
              {nameError && (
                <span className='text-destructive text-sm'>{nameError}</span>
              )}
            </div>
          ) : (
            <div className='flex items-center gap-2'>
              <span>{currentName}</span>
              <Button
                size='sm'
                variant='ghost'
                onClick={handleStartEditName}
                className='h-6 w-6 p-0'
                aria-label={t`Edit name`}
              >
                <Pencil className='size-3' />
              </Button>
            </div>
          )}
          <span className='text-muted-foreground'>
            <Trans>Path:</Trans>
          </span>
          {isEditingPath ? (
            <div className='flex flex-col gap-1'>
              <div className='flex items-center gap-2'>
                <Input
                  value={editPath}
                  onChange={(e) => {
                    setEditPath(e.target.value)
                    setPathError(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSaveEditPath()
                    if (e.key === 'Escape') handleCancelEditPath()
                  }}
                  className='h-8'
                  disabled={isSavingPath}
                  autoFocus
                />
                <Button
                  size='sm'
                  variant='ghost'
                  onClick={() => void handleSaveEditPath()}
                  disabled={isSavingPath}
                  className='h-8 w-8 p-0'
                >
                  {isSavingPath ? (
                    <Loader2 className='size-4 animate-spin' />
                  ) : (
                    <Check className='size-4' />
                  )}
                </Button>
                <Button
                  size='sm'
                  variant='ghost'
                  onClick={handleCancelEditPath}
                  disabled={isSavingPath}
                  className='h-8 w-8 p-0'
                  aria-label={t`Cancel edit`}
                >
                  <X className='size-4' />
                </Button>
              </div>
              {pathError && (
                <span className='text-destructive text-sm'>{pathError}</span>
              )}
            </div>
          ) : (
            <div className='flex items-center gap-2'>
              <span>{currentPath}</span>
              <Button
                size='sm'
                variant='ghost'
                onClick={handleStartEditPath}
                className='h-6 w-6 p-0'
                aria-label={t`Edit path`}
              >
                <Pencil className='size-3' />
              </Button>
            </div>
          )}
          <span className='text-muted-foreground'>
            <Trans>Entity:</Trans>
          </span>
          <DataChip value={repoId} truncate='none' />
          <span className='text-muted-foreground'>
            <Trans>Fingerprint:</Trans>
          </span>
          <DataChip value={fingerprint} truncate='middle' />
        </div>
      </div>

      <div className='space-y-2 py-4'>
        <Label className='text-base'>
          <Trans>Description</Trans>
        </Label>
        <Textarea
          id='description'
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={2000}
        />
        <Button
          size='sm'
          onClick={() => void handleSaveDescription()}
          disabled={
            updateSetting.isPending ||
            description === (initialDescription || '')
          }
        >
          <Check className='h-4 w-4' />
          <Trans>Save</Trans>
        </Button>
      </div>

      {branches.length > 0 && (
        <div className='flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between'>
          <div className='space-y-0.5'>
            <Label className='text-base'>
              <Trans>Default branch</Trans>
            </Label>
            <p className='text-muted-foreground text-sm'>
              <Trans>The branch shown when viewing the repository</Trans>
            </p>
          </div>
          <div className='w-full sm:w-48'>
            <Select
              value={selectedBranch}
              onValueChange={handleBranchChange}
              disabled={updateSetting.isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder={t`Select default branch`} />
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

      <div className='flex items-center justify-between py-4'>
        <Label htmlFor='settings-privacy' className='text-base'>
          <Trans>Allow anyone to search for repository</Trans>
        </Label>
        <Switch
          id='settings-privacy'
          checked={privacy}
          onCheckedChange={(value) => void handlePrivacyChange(value)}
          disabled={updateSetting.isPending}
        />
      </div>

      <div className='flex items-center justify-between py-4'>
        <Label htmlFor='settings-allow-read' className='text-base'>
          <Trans>Allow anyone to read repository</Trans>
        </Label>
        <Switch
          id='settings-allow-read'
          checked={allowRead}
          onCheckedChange={(value) => void handleAllowReadChange(value)}
          disabled={updateSetting.isPending}
        />
      </div>

      <div className='flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between'>
        <div className='space-y-0.5'>
          <Label className='text-base'>
            <Trans>Delete repository</Trans>
          </Label>
          <p className='text-muted-foreground text-sm'>
            <Trans>Permanently delete this repository and all its data</Trans>
          </p>
        </div>
        <Button
          variant='outline'
          onClick={() => setShowDeleteDialog(true)}
          disabled={deleteRepo.isPending}
        >
          <Trash2 className='h-4 w-4' />
          <Trans>Delete repository</Trans>
        </Button>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <Trans>Delete repository?</Trans>
            </AlertDialogTitle>
            <AlertDialogDescription>
              <Trans>
                This will permanently delete "{currentName}" and all its
                commits, branches, and tags. This action cannot be undone.
              </Trans>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Trans>Cancel</Trans>
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              <Trans>Delete</Trans>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function AccessSettingsTab({ repoId }: { repoId: string }) {
  const { t } = useLingui()
  const REPO_ACCESS_LEVELS = useRepoAccessLevels()
  const [rules, setRules] = useState<AccessRule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [userSearchQuery, setUserSearchQuery] = useState('')

  // User search - use class-level endpoint
  const { data: userSearchData, isLoading: userSearchLoading } = useQuery({
    queryKey: ['users', 'search', userSearchQuery],
    queryFn: () =>
      reposRequest.get<{ results: Array<{ id: string; name: string }> }>(
        `${endpoints.users.search}?q=${encodeURIComponent(userSearchQuery)}`,
        { baseURL: appBasePath() }
      ),
    enabled: userSearchQuery.length >= 1,
  })

  // Groups - use class-level endpoint
  const { data: groupsData } = useQuery({
    queryKey: ['groups', 'list'],
    queryFn: () =>
      reposRequest.get<{ groups: Array<{ id: string; name: string }> }>(
        endpoints.groups.list,
        { baseURL: appBasePath() }
      ),
  })

  const loadRules = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await reposRequest.get<{ rules: AccessRule[] }>(
        endpoints.repo.access,
        { baseURL: repoBasePath(repoId) }
      )
      setRules(response.rules ?? [])
    } catch (err) {
      setError(new Error(getErrorMessage(err, t`Failed to load access rules`)))
    } finally {
      setIsLoading(false)
    }
  }, [repoId])

  useEffect(() => {
    void loadRules()
  }, [loadRules])

  const handleAdd = async (
    subject: string,
    subjectName: string,
    operation: string
  ) => {
    // try/catch to match handleRevoke: toastAction surfaces the message but
    // still rejects, and AccessDialog does not catch, so the bare await left an
    // unhandled rejection on every failed grant.
    try {
      await toastAction(
        reposRequest.post(
          endpoints.repo.accessSet,
          { subject, permission: operation },
          { baseURL: repoBasePath(repoId) }
        ),
        {
          loading: t`Setting access...`,
          success: t`Access set for ${subjectName}`,
          error: (e) => getErrorMessage(e, t`Failed to set access level`),
        }
      )
      void loadRules()
    } catch {
      // toast already shown
    }
  }

  const handleRevoke = async (subject: string) => {
    try {
      await toastAction(
        reposRequest.post(
          endpoints.repo.accessRevoke,
          { subject },
          { baseURL: repoBasePath(repoId) }
        ),
        {
          loading: t`Removing access...`,
          success: t`Access removed`,
          error: (e) => getErrorMessage(e, t`Failed to remove access`),
        }
      )
      void loadRules()
    } catch {
      // toast already shown
    }
  }

  const handleLevelChange = async (subject: string, operation: string) => {
    try {
      await toastAction(
        reposRequest.post(
          endpoints.repo.accessSet,
          { subject, permission: operation },
          { baseURL: repoBasePath(repoId) }
        ),
        {
          loading: t`Updating access...`,
          success: t`Access level updated`,
          error: (e) => getErrorMessage(e, t`Failed to update access level`),
        }
      )
      void loadRules()
    } catch {
      // toast already shown
    }
  }

  return (
    <div className='space-y-4'>
      <div className='flex justify-end'>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className='h-4 w-4' />
          <Trans>Add</Trans>
        </Button>
      </div>

      <AccessDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onAdd={handleAdd}
        levels={REPO_ACCESS_LEVELS}
        defaultLevel='read'
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
