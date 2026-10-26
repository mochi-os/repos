// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { useState } from 'react'

// Two commits picked from a list, to compare. Picking a third lets go of the
// earlier of the two picks.
export function usePicked() {
  const [picked, setPicked] = useState<string[]>([])
  return {
    picked,
    toggle: (sha: string) =>
      setPicked((previous) =>
        previous.includes(sha)
          ? previous.filter((value) => value !== sha)
          : [...previous.slice(-1), sha]
      ),
    clear: () => setPicked([]),
  }
}
