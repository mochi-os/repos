// Characters disallowed in entity names (matches backend validation)
export const DISALLOWED_NAME_CHARS = /[<>\r\n]/

// Validate path: lowercase alphanumeric + hyphens, 1-100 chars, no leading/trailing hyphens
export function isValidPath(p: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,98}[a-z0-9]$/.test(p) || /^[a-z0-9]$/.test(p)
}
