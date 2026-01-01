import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  cn,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  requestHelpers,
  getErrorMessage,
  toast,
} from '@mochi/common'
import {
  FolderGit2,
  History,
  GitBranch,
  Tag,
  Settings,
  Download,
  Loader2,
  Copy,
  Check,
} from 'lucide-react'

export type TabId = 'files' | 'commits' | 'branches' | 'tags' | 'settings'

interface RepositoryNavProps {
  fingerprint: string
  name: string
  description?: string
  activeTab?: TabId
  isOwner?: boolean
}

export function RepositoryNav({ fingerprint, name, description, activeTab, isOwner }: RepositoryNavProps) {
  const tabs = [
    { id: 'files' as TabId, label: 'Files', icon: <FolderGit2 className="h-4 w-4" />, to: '/$repoId' as const },
    { id: 'commits' as TabId, label: 'Commits', icon: <History className="h-4 w-4" />, to: '/$repoId/commits' as const },
    { id: 'branches' as TabId, label: 'Branches', icon: <GitBranch className="h-4 w-4" />, to: '/$repoId/branches' as const },
    { id: 'tags' as TabId, label: 'Tags', icon: <Tag className="h-4 w-4" />, to: '/$repoId/tags' as const },
    { id: 'settings' as TabId, label: 'Settings', icon: <Settings className="h-4 w-4" />, to: '/$repoId/settings' as const },
  ]

  const visibleTabs = tabs.filter(tab => tab.id !== 'settings' || isOwner)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <FolderGit2 className="h-5 w-5" />
        <Link
          to="/$repoId"
          params={{ repoId: fingerprint }}
          className="text-xl font-semibold hover:underline"
        >
          {name}
        </Link>
        <div className="flex-1" />
        <CloneButton repoName={name} fingerprint={fingerprint} />
      </div>

      {/* Description */}
      {description && (
        <p className="text-muted-foreground">{description}</p>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b">
        {visibleTabs.map((tab) => {
          const isActive = tab.id === activeTab
          return (
            <Link
              key={tab.id}
              to={tab.to}
              params={{ repoId: fingerprint }}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                isActive
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50'
              )}
            >
              {tab.icon}
              {tab.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

interface TokenCreateResponse {
  token: string
}

function CloneButton({ repoName, fingerprint }: { repoName: string; fingerprint: string }) {
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
        const pathname = window.location.pathname
        const match = pathname.match(/^(\/[^/]+)\//)
        const appPrefix = match ? match[1] : ''
        const cloneUrl = `${window.location.origin}${appPrefix}/${fingerprint}/git`
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

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Download className="h-4 w-4" />
        Clone
      </Button>
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
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
