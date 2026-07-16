// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

// Characters disallowed in entity names (matches backend validation)
export const DISALLOWED_NAME_CHARS = /[<>\r\n]/

// Validate path: lowercase alphanumeric + hyphens, 1-100 chars, no leading/trailing hyphens
export function isValidPath(p: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,98}[a-z0-9]$/.test(p) || /^[a-z0-9]$/.test(p)
}
