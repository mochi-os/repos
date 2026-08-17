// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

// WebSocket hook for real-time repository updates.
//
// A subscribed repository caches its metadata locally, and its commits / files
// / branches are fetched on demand from the owner. When the owner edits the
// metadata (event_update) or pushes new activity (event_activity), the
// subscriber's cached view stays stale until a manual reload. The Starlark side
// emits {"type":"repository/update"} on those events; here we listen and
// invalidate the repository query tree so the view refreshes the moment the
// change lands.

import { useEntityInvalidationWebsocket } from "@mochi/web";

const REPOSITORY_EVENT_TYPES = ["repository/update"];
const REPOSITORY_QUERY_KEY = ["repositories"];

// Subscribe to repository WebSocket events and refresh repository data when a
// remote metadata edit or push activity lands locally.
export function useRepositoryWebsocket(repoFingerprint?: string) {
  useEntityInvalidationWebsocket({
    fingerprint: repoFingerprint,
    eventTypes: REPOSITORY_EVENT_TYPES,
    queryKey: REPOSITORY_QUERY_KEY,
  });
}
