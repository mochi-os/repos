// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { useLingui } from "@lingui/react/macro";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { FolderGit2 } from "lucide-react";
import { InlineEntitySearch, toastAction, getErrorMessage } from "@mochi/web";
import { reposRequest, appBasePath } from "@/api/request";
import endpoints from "@/api/endpoints";
import type { SearchResult, SearchResponse } from "@/api/types";
import { repoKeys, useSubscribe } from "@/hooks/use-repository";

interface InlineRepoSearchProps {
  subscribedIds: Set<string>;
  onRefresh?: () => void;
}

export function InlineRepoSearch({
  subscribedIds,
  onRefresh,
}: InlineRepoSearchProps) {
  const { t } = useLingui();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const subscribe = useSubscribe();

  const search = async (query: string): Promise<SearchResult[]> => {
    try {
      const response = await reposRequest.get<SearchResponse>(
        `${endpoints.repo.search}?search=${encodeURIComponent(query)}`,
        { baseURL: appBasePath() },
      );
      return response.results ?? [];
    } catch (error) {
      // The panel shows error.message, so the server's own wording has to be
      // pulled out here rather than left inside the axios error.
      throw new Error(getErrorMessage(error, t`Failed to search repositories`));
    }
  };

  const probe = async (url: string): Promise<SearchResult[]> => {
    const probed = await reposRequest.post<
      { data?: SearchResult } & Partial<SearchResult>
    >(endpoints.repo.probe, { url }, { baseURL: appBasePath() });
    const data: Partial<SearchResult> = probed?.data ?? probed ?? {};
    return data.id
      ? [
          {
            id: data.id,
            name: data.name ?? "",
            fingerprint: data.fingerprint ?? "",
            server: data.server,
            peer: data.peer,
          } as SearchResult,
        ]
      : [];
  };

  const handleSubscribe = async (repo: SearchResult) => {
    await toastAction(
      subscribe.mutateAsync({
        repository: repo.id,
        server: repo.server || undefined,
        peer: repo.peer,
      }),
      {
        loading: t`Subscribing...`,
        success: t`Subscribed`,
        error: (e) => getErrorMessage(e, t`Failed to subscribe`),
      },
    );
    void queryClient.invalidateQueries({ queryKey: repoKeys.info() });
    onRefresh?.();
    void navigate({ to: "/$repoId", params: { repoId: repo.id } });
  };

  return (
    <InlineEntitySearch
      subscribedIds={subscribedIds}
      search={search}
      probe={probe}
      onSubscribe={handleSubscribe}
      icon={FolderGit2}
      placeholder={t`Search for repositories...`}
      emptyMessage={t`No repositories found`}
      searchErrorMessage={t`Failed to search repositories`}
      subscribeLabel={t`Subscribe`}
    />
  );
}
