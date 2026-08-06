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
//
// The connection itself is the shared entityWebsocketManager, whose close path
// detaches handlers so the resubscribe on a token refresh cannot orphan a
// socket that keeps delivering events.

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAuthStore,
  entityWebsocketManager,
  type EntityWebsocketEvent,
} from "@mochi/web";

// Subscribe to repository WebSocket events and refresh repository data when a
// remote metadata edit or push activity lands locally.
export function useRepositoryWebsocket(repoFingerprint?: string) {
  const queryClient = useQueryClient();
  const authReady = useAuthStore((state) => state.isInitialized);
  const authToken = useAuthStore((state) => state.token);

  useEffect(() => {
    if (!authReady) return;
    if (!repoFingerprint) return;

    const handleMessage = (data: EntityWebsocketEvent) => {
      switch (data.type) {
        case "repository/update":
          // info, commits, branches, tags, tree and blob queries are all
          // rooted at ['repositories']; a metadata edit or new push activity
          // can affect any of them, so refresh the lot.
          void queryClient.invalidateQueries({ queryKey: ["repositories"] });
          break;
      }
    };

    return entityWebsocketManager.subscribe(repoFingerprint, handleMessage);
  }, [authReady, authToken, repoFingerprint, queryClient]);
}
