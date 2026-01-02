import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  cn,
  Button,
  CardDescription,
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
  Shield,
  Download,
  Loader2,
  Copy,
  Check,
} from 'lucide-react'

export type RepositoryTabId = 'files' | 'commits' | 'branches' | 'tags' | 'settings' | 'access'

interface Tab {
  id: RepositoryTabId
  label: string
  icon: React.ReactNode
  to: string
  ownerOnly?: boolean
}

const tabs: Tab[] = [
  { id: 'files', label: 'Files', icon: <FolderGit2 className="h-4 w-4" />, to: '/$repoId' },
  { id: 'commits', label: 'Commits', icon: <History className="h-4 w-4" />, to: '/$repoId/commits' },
  { id: 'branches', label: 'Branches', icon: <GitBranch className="h-4 w-4" />, to: '/$repoId/branches' },
  { id: 'tags', label: 'Tags', icon: <Tag className="h-4 w-4" />, to: '/$repoId/tags' },
  { id: 'access', label: 'Access', icon: <Shield className="h-4 w-4" />, to: '/$repoId/settings?tab=access', ownerOnly: true },
  { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" />, to: '/$repoId/settings', ownerOnly: true },
]

interface RepositoryHeaderProps {
  fingerprint: string
  name: string
  description?: string
  activeTab: RepositoryTabId
  isOwner?: boolean
}

export function RepositoryHeader({
  fingerprint,
  name,
  description,
  activeTab,
  isOwner,
}: RepositoryHeaderProps) {
  const visibleTabs = tabs.filter(tab => !tab.ownerOnly || isOwner)

  return (
    <div className="space-y-4">
      {/* Header with name, description, and clone button */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <FolderGit2 className="h-5 w-5" />
          <Link
            to="/$repoId"
            params={{ repoId: fingerprint }}
            className="text-xl font-semibold hover:underline"
          >
            {name}
          </Link>
        </div>
        <div className="flex-1" />
        <CloneDialog repoName={name} fingerprint={fingerprint} />
      </div>

      {description && (
        <CardDescription className="text-base">{description}</CardDescription>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b">
        {visibleTabs.map((tab) => (
          <Link
            key={tab.id}
            to={tab.to}
            params={{ repoId: fingerprint }}
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
          </Link>
        ))}
      </div>
    </div>
  )
}

// Token creation response type
interface TokenCreateResponse {
  token: string
}

function CloneDialog({ repoName, fingerprint }: { repoName: string; fingerprint: string }) {
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
