/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { format, formatDistanceToNow } from "date-fns";

import type { UserSettings } from "@/lib/schemas/user-settings";

/**
 * date-fns patterns backing `UserSettings.display.dateFormat` — the compact style used in table
 * and list columns. Keyed by preset id rather than exposing raw date-fns patterns as a setting,
 * so the choices stay curated.
 */
export const DATE_FORMAT_PATTERNS: Record<UserSettings["display"]["dateFormat"], string> = {
    ISO: "yyyy-MM-dd",
    Slash: "dd/MM/yyyy",
    Written: "MMM d, yyyy",
};

/** Same idea as `DATE_FORMAT_PATTERNS`, for `UserSettings.display.dateTimeFormat` — the fuller
 *  style used for things like entity created/updated timestamps. */
export const DATE_TIME_FORMAT_PATTERNS: Record<UserSettings["display"]["dateTimeFormat"], string> =
    {
        ISO: "yyyy-MM-dd HH:mm",
        Slash: "dd/MM/yyyy h:mm a",
        Written: "MMMM d, yyyy 'at' h:mm a",
    };

/**
 * Formats a date string for display to the user.
 *
 * Currently always renders the `ISO` preset (`DATE_FORMAT_PATTERNS`) regardless of the caller's
 * `UserSettings.display.dateFormat` — wiring this up to the user's actual preference is a
 * follow-up, since many call sites are plain Server Components with no per-user context today.
 *
 * @param dateOrString The date or date string to format.
 * @returns The formatted date string.
 */
export function formatDate(dateOrString: string | Date): string {
    const date = new Date(dateOrString);
    return format(date, DATE_FORMAT_PATTERNS.ISO);
}

/** Same caveat as `formatDate` — always renders the `ISO` preset for now. */
export function formatDateTime(dateOrString: string | Date): string {
    const date = new Date(dateOrString);
    return format(date, DATE_TIME_FORMAT_PATTERNS.ISO);
}

export function formatRelativeDateTime(dateOrString: string | Date): string {
    const date = new Date(dateOrString);
    return formatDistanceToNow(date, { addSuffix: true });
}
