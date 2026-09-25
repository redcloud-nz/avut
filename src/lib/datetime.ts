/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { format, formatDistanceToNow } from "date-fns";

import { TZDate } from "@date-fns/tz";

import { UserSettings } from "@/lib/schemas/user-settings";

export const DATE_FORMAT_LABELS: Record<keyof typeof DATE_FORMAT_PATTERNS, string> = {
    "iso-basic": "ISO Basic",
    "iso-extended": "ISO Extended",
    "iso-ordinal": "ISO Ordinal",
    slash: "Slash",
    dot: "Dot",
    written: "Written",
};

export const TIME_FORMAT_LABELS: Record<keyof typeof TIME_FORMAT_PATTERNS, string> = {
    "12-hour": "12 Hour",
    "24-hour": "24 Hour",
};

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
 * The subset of a user's settings that governs how a date or time is rendered — the `display`
 * slice of `UserSettings`, named separately so a formatter's signature doesn't imply it reads
 * anything else.
 */
export type DisplayPreferences = UserSettings["display"];

/**
 * What the formatters fall back to when no preference is supplied.
 *
 * Taken from the schema rather than restated, so a change to the declared default of
 * `display.dateFormat`/`display.timeFormat` moves this with it.
 */
export const DEFAULT_DISPLAY_PREFERENCES: DisplayPreferences = UserSettings.default().display;

/**
 * Formats a date for display to the user.
 *
 * `prefs` is optional, and omitting it renders `DEFAULT_DISPLAY_PREFERENCES` — i.e. the call
 * site ignores the viewer's preference. That's the state most call sites are still in: only the
 * entity created/updated cards (`DLDateDetails`) pass real preferences today. Reaching the rest
 * means threading preferences into TanStack table column definitions and `FieldValue`, which is
 * deliberately a separate change.
 *
 * Client components get preferences from `usePreferences()`; server components from
 * `getDisplayPreferences()` in `@/server/display-preferences`.
 */
export function formatDate(
    dateOrString: string | Date,
    prefs: DisplayPreferences = DEFAULT_DISPLAY_PREFERENCES,
): string {
    return format(
        new TZDate(new Date(dateOrString), prefs.timeZone),
        DATE_FORMAT_PATTERNS[prefs.dateFormat],
    );
}

/** Same `prefs` contract as `formatDate`, rendering the date and time together. */
export function formatDateTime(
    dateOrString: string | Date,
    prefs: DisplayPreferences = DEFAULT_DISPLAY_PREFERENCES,
): string {
    return format(
        new TZDate(new Date(dateOrString), prefs.timeZone),
        `${DATE_FORMAT_PATTERNS[prefs.dateFormat]} ${TIME_FORMAT_PATTERNS[prefs.timeFormat]}`,
    );
}

/**
 * A coarse "3 days ago" rendering. Takes no preferences: the wording is relative to *now*, so
 * neither format preset applies.
 */
export function formatRelativeDateTime(dateOrString: string | Date): string {
    const date = new Date(dateOrString);
    return formatDistanceToNow(date, { addSuffix: true });
}
