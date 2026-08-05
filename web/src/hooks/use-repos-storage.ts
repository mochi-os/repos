// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

// Shell storage for the repositories app - remembers the last visited repo.
// null means the "All Repositories" view, a repo ID means a specific repository.

import { createLastEntityStorage } from "@mochi/web";

const storage = createLastEntityStorage("mochi-repos-last");

export const setLastRepo = storage.set;
export const getLastRepo = storage.get;
export const clearLastRepo = storage.clear;
