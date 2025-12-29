import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { FolderGit2, Plus } from 'lucide-react'
import {
  Button,
  Input,
  Label,
  Textarea,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Switch,
  usePageTitle,
  Header,
  Main,
  getErrorMessage,
  getAppPath,
} from '@mochi/common'
import { useCreateRepo } from '@/hooks/use-repository'

export const Route = createFileRoute('/_authenticated/new')({
  component: NewRepositoryPage,
})

function NewRepositoryPage() {
  usePageTitle('New Repository')
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(true)

  const createRepo = useCreateRepo()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error('Repository name is required')
      return
    }

    if (name.trim().length > 100) {
      toast.error('Repository name is too long (max 100 characters)')
      return
    }

    createRepo.mutate(
      {
        name: name.trim(),
        description: description.trim(),
        public: isPublic ? 'true' : 'false',
      },
      {
        onSuccess: (response) => {
          toast.success('Repository created')
          // Navigate to the new repository
          const id = response?.data?.id
          if (id) {
            window.location.href = `${getAppPath()}/${id}`
          } else {
            navigate({ to: '/' })
          }
        },
        onError: (error) => {
          toast.error(getErrorMessage(error, 'Failed to create repository'))
        },
      }
    )
  }

  const handleCancel = () => {
    navigate({ to: '/' })
  }

  return (
    <>
      <Header>
        <h1 className="text-lg font-semibold">New Repository</h1>
      </Header>
      <Main>
        <div className="container mx-auto max-w-lg p-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderGit2 className="h-5 w-5" />
                Create new repository
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Repository name</Label>
                  <Input
                    id="name"
                    placeholder="My repository"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="A short description of your repository"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="flex items-center justify-between rounded-[8px] border px-4 py-3">
                  <Label htmlFor="public" className="text-sm font-medium">
                    Allow anyone to view repository
                  </Label>
                  <Switch
                    id="public"
                    checked={isPublic}
                    onCheckedChange={setIsPublic}
                    disabled={createRepo.isPending}
                  />
                </div>

                <div className="flex gap-2 justify-end pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={createRepo.isPending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createRepo.isPending}>
                    <Plus className="mr-2 h-4 w-4" />
                    {createRepo.isPending ? 'Creating...' : 'Create repository'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </Main>
    </>
  )
}
