import { useState } from 'react'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  getErrorMessage,
  toast,
} from '@mochi/web'
import { Download, Loader2 } from 'lucide-react'
import { reposRequest } from '@/api/request'

type Format = 'zip' | 'tar.gz' | 'tar.bz2'

const FORMATS: { format: Format; label: string }[] = [
  { format: 'tar.bz2', label: 'tar.bz2' },
  { format: 'tar.gz', label: 'tar.gz' },
  { format: 'zip', label: 'zip' },
]

interface DownloadDropdownProps {
  gitRef: string
  variant?: 'button' | 'icon'
  disabled?: boolean
}

export function DownloadDropdown({
  gitRef,
  variant = 'button',
  disabled,
}: DownloadDropdownProps) {
  const [busy, setBusy] = useState<Format | null>(null)

  const handleDownload = async (format: Format) => {
    if (busy) return
    setBusy(format)
    try {
      await reposRequest.download(
        `archive/${format}`,
        `archive.${format}`,
        { params: { ref: gitRef } }
      )
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to download archive"))
    } finally {
      setBusy(null)
    }
  }

  const trigger =
    variant === 'icon' ? (
      <Button
        variant="ghost"
        size="icon"
        disabled={disabled || !!busy}
        onClick={(e) => e.stopPropagation()}
        aria-label={"Download"}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
      </Button>
    ) : (
      <Button variant="outline" size="sm" disabled={disabled || !!busy}>
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        Download
      </Button>
    )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {FORMATS.map((f) => (
          <DropdownMenuItem
            key={f.format}
            onSelect={() => void handleDownload(f.format)}
            disabled={!!busy}
          >
            {f.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
