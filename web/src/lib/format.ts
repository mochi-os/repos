import { formatTimestamp } from '@mochi/common'

// Format a git date string (ISO 8601) to locale date + time
export function formatGitDate(dateString: string): string {
  const timestamp = Math.floor(new Date(dateString).getTime() / 1000)
  return formatTimestamp(timestamp)
}

// Format file size in bytes to human-readable string
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}
