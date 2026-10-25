/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import type { SearchableSelectOption } from "@/components/ui/searchable-select";

/**
 * Every IANA zone the runtime knows, each with today's UTC offset as its subtitle so a zone can
 * be identified without recognising its name.
 */
export function timeZoneOptions(): SearchableSelectOption[] {
    return Intl.supportedValuesOf("timeZone").map((zone) => ({
        value: zone,
        label: zone,
        subtitle: new Intl.DateTimeFormat("en-US", {
            timeZone: zone,
            timeZoneName: "shortOffset",
        })
            .formatToParts(new Date())
            .find((part) => part.type === "timeZoneName")?.value,
    }));
}
