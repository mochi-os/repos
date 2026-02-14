import { useState, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Switch,
  Textarea,
  toast,
  getErrorMessage,
} from '@mochi/common'
import { FolderGit2, Loader2, Plus } from 'lucide-react'
import { useCreateRepo } from '@/hooks/use-repository'

type CreateRepositoryDialogProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
}

import { DISALLOWED_NAME_CHARS, isValidPath } from '@/lib/validation'

// Derive a URL-safe slug from a name
function nameToPath(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function CreateRepositoryDialog({
  open,
  onOpenChange,
  hideTrigger,
}: CreateRepositoryDialogProps) {
  const navigate = useNavigate()
  const createRepo = useCreateRepo()

  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [description, setDescription] = useState('')
  const [privacy, setPrivacy] = useState(true) // true = public
  const [allowRead, setAllowRead] = useState(true)
  const pathDirty = useRef(false)

  const resetForm = () => {
    setName('')
    setPath('')
    setDescription('')
    setPrivacy(true)
    setAllowRead(true)
    pathDirty.current = false
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) resetForm()
    onOpenChange?.(isOpen)
  }

  const handleNameChange = (value: string) => {
    setName(value)
    if (!pathDirty.current) {
      setPath(nameToPath(value))
    }
  }

  const handlePathChange = (value: string) => {
    pathDirty.current = true
    setPath(value)
  }

  const nameError =
    name && DISALLOWED_NAME_CHARS.test(name)
      ? 'Name cannot contain < > \\ ; " \' or ` characters'
      : name.length > 100
        ? 'Name must be 100 characters or less'
        : null

  const pathError =
    path && !isValidPath(path)
      ? 'Lowercase letters, numbers, and hyphens only'
      : null

  const canSubmit = name.trim() && path.trim() && !nameError && !pathError && !createRepo.isPending

  const handleSubmit = () => {
    if (!canSubmit) return
    createRepo.mutate(
      {
        name: name.trim(),
        path: path.trim(),
        description,
        allow_read: allowRead ? 'true' : 'false',
        privacy: privacy ? 'public' : 'private',
      },
      {
        onSuccess: (response) => {
          toast.success('Repository created')
          resetForm()
          handleOpenChange(false)
          if (response?.fingerprint) {
            void navigate({ to: '/$repoId', params: { repoId: response.fingerprint } })
          } else {
            void navigate({ to: '/' })
          }
        },
        onError: (error) => {
          toast.error(getErrorMessage(error, 'Failed to create repository'))
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!hideTrigger && (
        <Button onClick={() => handleOpenChange(true)}>
          <Plus className="h-4 w-4" />
          Create repository
        </Button>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderGit2 className="h-5 w-5" />
            Create repository
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="repo-name">Name</Label>
            <Input
              id="repo-name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
              autoFocus
            />
            {nameError && <p className="text-sm text-destructive">{nameError}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="repo-path">Path</Label>
            <Input
              id="repo-path"
              value={path}
              onChange={(e) => handlePathChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
            />
            {pathError && <p className="text-sm text-destructive">{pathError}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="repo-description">Description</Label>
            <Textarea
              id="repo-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="repo-privacy">Allow anyone to search for repository</Label>
            <Switch id="repo-privacy" checked={privacy} onCheckedChange={setPrivacy} />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="repo-allow-read">Allow anyone to read repository</Label>
            <Switch id="repo-allow-read" checked={allowRead} onCheckedChange={setAllowRead} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {createRepo.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
