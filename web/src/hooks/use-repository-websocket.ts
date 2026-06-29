// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

// WebSocket hook for real-time repository updates.
//
// A subscribed repository caches its metadata locally, and its commits / files
// / branches are fetched on demand from the owner. When the owner edits the
// metadata (event_update) or pushes new activity (event_activity), the
// subscriber's cached view stays stale until a manual reload. The Starlark side
// now emits {"type":"repository/update"} on those events; here we listen and
// invalidate the repository query tree so the view refreshes the moment the
// change lands.

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@mochi/web";

interface RepositoryWebsocketEvent {
  type: string;
  repository?: string;
}

const RECONNECT_DELAY = 3000;

function getWebSocketUrl(key: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const raw = useAuthStore.getState().token;
  const token = raw?.startsWith("Bearer ") ? raw.slice(7) : raw;
  const tokenParam = token ? `&token=${encodeURIComponent(token)}` : "";
  return `${protocol}//${window.location.host}/_/websocket?key=${key}${tokenParam}`;
}

// Singleton WebSocket manager to prevent duplicate connections
class WebSocketManager {
  private connections = new Map<string, WebSocket>();
  private reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private subscribers = new Map<
    string,
    Set<(event: RepositoryWebsocketEvent) => void>
  >();
  private connectionAttempts = new Map<string, boolean>();

  subscribe(
    key: string,
    callback: (event: RepositoryWebsocketEvent) => void,
  ): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(callback);
    this.ensureConnection(key);

    return () => {
      const subs = this.subscribers.get(key);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscribers.delete(key);
          this.closeConnection(key);
        }
      }
    };
  }

  private ensureConnection(key: string) {
    const existing = this.connections.get(key);
    if (
      existing &&
      (existing.readyState === WebSocket.OPEN ||
        existing.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    if (this.connectionAttempts.get(key)) return;
    this.connect(key);
  }

  private connect(key: string) {
    const timer = this.reconnectTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(key);
    }
    if (!this.subscribers.has(key) || this.subscribers.get(key)!.size === 0) {
      return;
    }

    this.connectionAttempts.set(key, true);

    try {
      const ws = new WebSocket(getWebSocketUrl(key));
      this.connections.set(key, ws);

      ws.onopen = () => {
        this.connectionAttempts.set(key, false);
      };

      ws.onmessage = (event) => {
        try {
          const data: RepositoryWebsocketEvent = JSON.parse(event.data);
          const subs = this.subscribers.get(key);
          if (subs) {
            subs.forEach((callback) => callback(data));
          }
        } catch {
          // Ignore parse errors
        }
      };

      ws.onclose = () => {
        this.connectionAttempts.set(key, false);
        this.connections.delete(key);
        if (
          this.subscribers.has(key) &&
          this.subscribers.get(key)!.size > 0
        ) {
          const t = setTimeout(() => this.connect(key), RECONNECT_DELAY);
          this.reconnectTimers.set(key, t);
        }
      };

      ws.onerror = () => {
        this.connectionAttempts.set(key, false);
      };
    } catch {
      this.connectionAttempts.set(key, false);
      if (
        this.subscribers.has(key) &&
        this.subscribers.get(key)!.size > 0
      ) {
        const t = setTimeout(() => this.connect(key), RECONNECT_DELAY);
        this.reconnectTimers.set(key, t);
      }
    }
  }

  private closeConnection(key: string) {
    const timer = this.reconnectTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(key);
    }
    const ws = this.connections.get(key);
    if (ws) {
      ws.close();
      this.connections.delete(key);
    }
    this.connectionAttempts.delete(key);
  }
}

const wsManager = new WebSocketManager();

// Subscribe to repository WebSocket events and refresh repository data when a
// remote metadata edit or push activity lands locally.
export function useRepositoryWebsocket(repoFingerprint?: string) {
  const queryClient = useQueryClient();
  const authReady = useAuthStore((state) => state.isInitialized);
  const authToken = useAuthStore((state) => state.token);

  useEffect(() => {
    if (!authReady) return;
    if (!repoFingerprint) return;

    const handleMessage = (data: RepositoryWebsocketEvent) => {
      switch (data.type) {
        case "repository/update":
          // info, commits, branches, tags, tree and blob queries are all
          // rooted at ['repositories']; a metadata edit or new push activity
          // can affect any of them, so refresh the lot.
          void queryClient.invalidateQueries({ queryKey: ["repositories"] });
          break;
      }
    };

    return wsManager.subscribe(repoFingerprint, handleMessage);
  }, [authReady, authToken, repoFingerprint, queryClient]);
}
