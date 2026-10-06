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
 * The schema's declared `display` defaults — what a user who never visited Preferences sees.
 * Not a fallback for the formatters, whose `prefs` is required so a call site can't silently
 * ignore the viewer's choice; it's here for the settings preview and tests.
 *
 * Taken from the schema rather than restated, so a change to the declared default of
 * `display.dateFormat`/`display.timeFormat` moves this with it.
 */
export const DEFAULT_DISPLAY_PREFERENCES: DisplayPreferences = UserSettings.default().display;

/**
 * Formats a date for display to the user, in their `dateFormat` preset and `timeZone`.
 *
 * Client components take the bound `formatDate` from `usePreferences()` rather than calling this
 * directly; server components pass `getDisplayPreferences()` from `@/server/display-preferences`.
 */
export function formatDate(dateOrString: string | Date, prefs: DisplayPreferences): string {
    return format(
        new TZDate(new Date(dateOrString), prefs.timeZone),
        DATE_FORMAT_PATTERNS[prefs.dateFormat],
    );
}

/** Same `prefs` contract as `formatDate`, rendering the date and time together. */
export function formatDateTime(dateOrString: string | Date, prefs: DisplayPreferences): string {
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
