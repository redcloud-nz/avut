/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useEffect, useRef } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";

import { settingsEffects } from "@/client/settings-effects";
import { trpc } from "@/trpc/client";

/**
 * Silently adopts the browser's IANA zone as `display.timeZone` the first time a user with no
 * saved preference loads the app, rather than leaving them on the schema's `Pacific/Auckland`
 * default — which is wrong for anyone outside NZ until they find the Time Zone setting
 * themselves. Renders nothing.
 *
 * Mounted once per authenticated session (see the `(authenticated)` layout, alongside
 * `SessionWatcher`), not from `usePreferences()` itself — that hook is called from many
 * components on a page, and this write must happen at most once regardless.
 *
 * `hasUserTimeZonePreference` gates it rather than comparing the resolved zone against the
 * default, so a user who explicitly opens Settings and picks a zone never gets silently
 * reverted by this effect on a later visit from a different browser/device.
 */
export function TimeZoneAutoDetect() {
    const { data: hasPreference } = useQuery(
        trpc.settings.hasUserTimeZonePreference.queryOptions(),
    );
    const mutation = useMutation(
        trpc.settings.updateUserSettingsSlice.mutationOptions({
            meta: { effects: settingsEffects.updateUserSettingsSlice },
        }),
    );

    // Tracks whether the mutation has already been fired, independent of React render
    // timing — `mutation.status` alone isn't safe in the effect's deps array (Strict Mode's
    // double-invoke would otherwise fire it twice before the first `mutate` call flips status
    // away from "idle").
    const firedRef = useRef(false);

    useEffect(() => {
        if (hasPreference !== false || firedRef.current) return;
        firedRef.current = true;

        const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
        mutation.mutate({ update: { slice: "display", patch: { timeZone: detected } } });
        // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once when hasPreference first resolves false
    }, [hasPreference]);

    return null;
}
