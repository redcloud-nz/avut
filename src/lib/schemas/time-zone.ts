/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

/**
 * Whether the runtime recognises `value` as an IANA zone. Asking `Intl` rather than
 * checking against a baked-in list, so the check tracks whatever zone database the runtime
 * ships with instead of going stale.
 */
export function isValidTimeZone(value: string): boolean {
    try {
        new Intl.DateTimeFormat("en-US", { timeZone: value });
        return true;
    } catch {
        return false;
    }
}

/** An IANA time zone name, e.g. `"Pacific/Auckland"`. */
export type TimeZone = string;

export const TimeZone = {
    /**
     * An IANA zone the runtime recognises. Shared by the user's `display.timeZone` and the
     * organization's `general.timeZone`; each adds its own default.
     */
    schema: z.string().refine(isValidTimeZone, "Unknown IANA time zone"),
};
