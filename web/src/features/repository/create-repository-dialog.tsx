import { useNavigate } from '@tanstack/react-router'
import {
  CreateEntityDialog,
  type CreateEntityValues,
  toast,
  getErrorMessage,
} from '@mochi/common'
import { FolderGit2 } from 'lucide-react'
import { useCreateRepo } from '@/hooks/use-repository'

type CreateRepositoryDialogProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
}

export function CreateRepositoryDialog({
  open,
  onOpenChange,
  hideTrigger,
}: CreateRepositoryDialogProps) {
  const navigate = useNavigate()
  const createRepo = useCreateRepo()

  const handleSubmit = async (values: CreateEntityValues) => {
    return new Promise<void>((resolve, reject) => {
      createRepo.mutate(
        {
          name: values.name,
          description: values.description ?? '',
          allow_read: values.toggles?.allowRead ? 'true' : 'false',
          privacy: values.privacy ?? 'public',
        },
        {
          onSuccess: (response) => {
            toast.success('Repository created')
            if (response?.fingerprint) {
              void navigate({ to: '/$repoId', params: { repoId: response.fingerprint } })
            } else {
              void navigate({ to: '/' })
            }
            resolve()
          },
          onError: (error) => {
            toast.error(getErrorMessage(error, 'Failed to create repository'))
            reject(error)
          },
        }
      )
    })
  }

  return (
    <CreateEntityDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={FolderGit2}
      title="Create repository"
      entityLabel="Repository"
      showDescription
      showPrivacyToggle
      privacyLabel="Allow anyone to search for repository"
      extraToggles={[
        {
          name: 'allowRead',
          label: 'Allow anyone to read repository',
          defaultValue: true,
        },
      ]}
      onSubmit={handleSubmit}
      isPending={createRepo.isPending}
      hideTrigger={hideTrigger}
    />
  )
}
