/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import "server-only";

import { cache } from "react";

import type { DisplayPreferences } from "@/lib/datetime";
import { getUserSettings } from "@/server/cache/user-settings";
import { requireSession } from "@/server/session";

/**
 * The current user's date/time display preferences, for a Server Component that formats a date
 * itself rather than delegating to a client component.
 *
 * The client-side counterpart is `usePreferences()` (`@/hooks/use-preferences`) — prefer that
 * where the component is already a Client Component, since it shares the query the authenticated
 * layout already fetches.
 *
 * Cheap to call repeatedly: `getUserSettings` is `"use cache"`-tagged per user, `getSession` is
 * `cache()`-wrapped per request, and this adds its own request-scoped `cache()` on top.
 */
export const getDisplayPreferences = cache(async (): Promise<DisplayPreferences> => {
    const session = await requireSession();
    const settings = await getUserSettings(session.user.id);

    return settings.display;
});
