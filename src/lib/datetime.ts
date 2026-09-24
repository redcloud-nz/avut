/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { format, formatDistanceToNow } from "date-fns";

import type { UserSettings } from "@/lib/schemas/user-settings";

/**
 * date-fns patterns backing `UserSettings.display.dateFormat`. Keyed by preset id rather than
 * exposing raw date-fns patterns as a setting, so the choices stay curated.
 */
export const DATE_FORMAT_PATTERNS: Record<UserSettings["display"]["dateFormat"], string> = {
    "iso-basic": "yyyyMMdd",
    "iso-extended": "yyyy-MM-dd",
    "iso-ordinal": "yyyy-DDD",
    slash: "dd/MM/yyyy",
    dot: "dd.MM.yyyy",
    written: "dd MMM yyyy",
};

/** Same idea as `DATE_FORMAT_PATTERNS`, for `UserSettings.display.timeFormat`. */
export const TIME_FORMAT_PATTERNS: Record<UserSettings["display"]["timeFormat"], string> = {
    "12-hour": "h:mm a",
    "24-hour": "HH:mm",
};

/**
 * Formats a date string for display to the user.
 *
 * Currently always renders the `iso-extended` preset (`DATE_FORMAT_PATTERNS`) regardless of the
 * caller's `UserSettings.display.dateFormat` — wiring this up to the user's actual preference is
 * a follow-up, since many call sites are plain Server Components with no per-user context today.
 *
 * @param dateOrString The date or date string to format.
 * @returns The formatted date string.
 */
export function formatDate(dateOrString: string | Date): string {
    const date = new Date(dateOrString);
    return format(date, DATE_FORMAT_PATTERNS["iso-extended"]);
}

/** Same caveat as `formatDate` — always renders the `iso-extended` + `24-hour` presets for now. */
export function formatDateTime(dateOrString: string | Date): string {
    const date = new Date(dateOrString);
    return format(
        date,
        `${DATE_FORMAT_PATTERNS["iso-extended"]} ${TIME_FORMAT_PATTERNS["24-hour"]}`,
    );
}

export function formatRelativeDateTime(dateOrString: string | Date): string {
    const date = new Date(dateOrString);
    return formatDistanceToNow(date, { addSuffix: true });
}
