// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

// The name pattern is the server's, shared through @mochi/web.
export { DISALLOWED_NAME_CHARS } from '@mochi/web'

// Validate path: lowercase alphanumeric + hyphens, 1-100 chars, no leading/trailing hyphens
export function isValidPath(p: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,98}[a-z0-9]$/.test(p) || /^[a-z0-9]$/.test(p)
}

// Hostname of a subscribed repository's server, or null when it is not a URL
// we can render. The stored value is whatever a.input("server", "") accepted at
// subscribe time, so "http" and "httpx" both reach here; new URL() throws on
// them, and an exception during render takes the whole page down.
export function serverHost(server?: string): string | null {
  if (!server) return null
  try {
    const parsed = new URL(server)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.hostname || null
  } catch {
    return null
  }
}
