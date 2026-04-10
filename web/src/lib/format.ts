// Extract first line of a commit message, truncated to 72 chars
export function getCommitTitle(message: string): string {
  const firstLine = message.split('\n')[0]
  return firstLine.length > 72 ? firstLine.substring(0, 69) + '...' : firstLine
}
