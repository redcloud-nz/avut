/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useCallback } from "react";

import { useOrganization } from "@/hooks/use-organization";
import { usePreferences } from "@/hooks/use-preferences";
import { formatSessionWhen } from "@/lib/session-timing";

/** `formatSessionWhen` bound to the org's time zone and the viewer's display preferences. */
export function useFormatSessionWhen() {
    const organization = useOrganization();
    const { display } = usePreferences();
    const orgZone = organization.settings.general.timeZone;

    return useCallback(
        (startsAt: string | Date, endsAt: string | Date | null) =>
            formatSessionWhen(startsAt, endsAt, { orgZone, prefs: display }),
        [orgZone, display],
    );
}
