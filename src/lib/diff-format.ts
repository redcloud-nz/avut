/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { formatDateTime, type DisplayPreferences } from "@/lib/datetime";
import type { DiffChange, DiffValues } from "@/lib/diff";
import type { LogObjectType } from "@/lib/schemas/log-entry";

/**
 * Display-ready rendering of a stored `DiffChange`, for a history page.
 *
 * Pure (no JSX), so the mapping is unit-testable; the component turns the descriptor into markup.
 * Every input is a row read back from the audit log, so nothing here throws on a value it doesn't
 * recognise — it falls back to the raw string instead.
 */

/** How a field changed, in the reader's terms rather than the diff's. */
export type ChangeKind =
    | "set"
    | "cleared"
    | "changed"
    | "added"
    | "removed"
    | "masked"
    | "reordered";

export interface ChangeDescriptor {
    /** The humanised (or overridden) field path, e.g. "Properties › Call sign". */
    field: string;
    kind: ChangeKind;
    /** The formatted value before the change, where the change carries one. */
    prev?: string;
    /** The formatted value after the change, where the change carries one. */
    curr?: string;
}

export interface DescribeChangeOptions {
    /** Field-label overrides, keyed by the joined path (`"properties.callSign"`). */
    labels?: Record<string, string>;
    /** The viewer's display preferences, used for datetime values. */
    prefs?: DisplayPreferences;
}

/**
 * Field-label overrides per object type, for fields whose humanised name reads badly.
 *
 * Keyed by the **entry's own** `objectType`, not the page's: a related `TeamMembership` entry on
 * a Person's history carries `TeamMembership` fields. Empty until a real field needs one.
 */
export const FieldLabels: Partial<Record<LogObjectType, Record<string, string>>> = {};

/** Object-type labels where humanising the type name isn't good enough. */
const objectTypeLabelOverrides: Partial<Record<LogObjectType, string>> = {
    Session: "Sign-in session",
};

/**
 * Whole words replaced after splitting an identifier, keyed by the lowercased word: acronyms that
 * would otherwise come out as "Id"/"Url", and en-NZ spellings of identifier words (the code says
 * `organization`, the copy says "organisation").
 */
const wordReplacements: Record<string, string> = {
    d4h: "D4H",
    id: "ID",
    ids: "IDs",
    organization: "organisation",
    organizations: "organisations",
    url: "URL",
};

/**
 * Splits camelCase, PascalCase, snake_case and kebab-case into words, keeping a run of capitals
 * (with digits) together as one acronym: `D4HAccessToken` → `D4H`, `Access`, `Token`.
 */
const WORD_PATTERN = /[A-Z][a-z]+|[A-Z0-9]+(?![a-z])|[a-z0-9]+|[A-Z0-9]+/g;

/** A record lookup that ignores inherited keys, so a field named `constructor` isn't a hit. */
function ownValue<T>(record: Partial<Record<string, T>> | undefined, key: string): T | undefined {
    return record && Object.hasOwn(record, key) ? record[key] : undefined;
}

function isAcronym(word: string): boolean {
    return word.length > 1 && word === word.toUpperCase() && /[A-Z]/.test(word);
}

/** `"callSign"` → `"Call sign"`, `"D4HAccessToken"` → `"D4H access token"`. */
function humanise(identifier: string): string {
    const words = identifier.match(WORD_PATTERN);
    if (!words) return identifier;

    return words
        .map((word, index) => {
            const replaced = ownValue(wordReplacements, word.toLowerCase());
            const text = replaced ?? (isAcronym(word) ? word : word.toLowerCase());
            return index === 0 ? text.charAt(0).toUpperCase() + text.slice(1) : text;
        })
        .join(" ");
}

/**
 * A field path for display. An exact override in `labels` (keyed by the path joined with `.`)
 * wins; otherwise each segment is humanised and the segments are joined with " › ".
 */
export function formatFieldPath(path: string[], labels?: Record<string, string>): string {
    const override = ownValue(labels, path.join("."));
    if (override !== undefined) return override;
    return path.map(humanise).join(" › ");
}

/**
 * An ISO datetime with optional fractional seconds and a `Z` or `±hh:mm` offset. That covers
 * both `Date.prototype.toISOString()` (how `diffObject` stores a `Date`) and `formatISO` (what
 * `DatePicker` emits: no milliseconds, a local offset). Matched in full so a string that merely
 * starts with a date isn't reformatted.
 */
const ISO_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * A stored diff value for display: `null`/`""` → "(empty)", booleans → "Yes"/"No", arrays → a
 * comma list, ISO datetime strings → `formatDateTime` with `prefs`, anything else as-is.
 */
export function formatDiffValue(value: DiffValues, prefs?: DisplayPreferences): string {
    if (Array.isArray(value)) {
        if (value.length === 0) return "(empty)";
        return value.map((item) => formatDiffValue(item, prefs)).join(", ");
    }
    if (value === null || value === "") return "(empty)";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "number") return String(value);
    if (ISO_DATETIME_PATTERN.test(value)) {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) return formatDateTime(date, prefs);
    }
    return value;
}

/** Maps one `DiffChange` to a display descriptor. */
export function describeChange(
    change: DiffChange,
    options: DescribeChangeOptions = {},
): ChangeDescriptor {
    const { labels, prefs } = options;
    const field = formatFieldPath(change.path, labels);
    const format = (value: DiffValues) => formatDiffValue(value, prefs);

    switch (change.type) {
        case "obj_add":
            // Always "set", even for an empty value: a create is logged as `diffObject({}, record)`,
            // so every empty optional field arrives here, and "cleared" would misreport it.
            return { field, kind: "set", curr: format(change.curr) };
        case "obj_del":
            return { field, kind: "cleared", prev: format(change.prev) };
        case "obj_mod":
            return { field, kind: "changed", prev: format(change.prev), curr: format(change.curr) };
        case "obj_mask":
            return { field, kind: "masked" };
        case "arr_add":
            return { field, kind: "added", curr: format(change.value) };
        case "arr_del":
            return { field, kind: "removed", prev: format(change.value) };
        case "arr_ord":
            return {
                field,
                kind: "reordered",
                prev: format(change.prev),
                curr: format(change.curr),
            };
    }
}

/**
 * A display label for a log object type: `"TeamMembership"` → "Team membership". Takes a plain
 * string because stored rows aren't parsed strictly; an unknown type is humanised the same way.
 */
export function objectTypeLabel(type: string): string {
    return ownValue<string>(objectTypeLabelOverrides, type) ?? humanise(type);
}

/** Past-tense forms of `LogAction`, for "Created by …". Keyed by string: stored rows aren't strict. */
const actionPastTense: Partial<Record<string, string>> = {
    Approve: "Approved",
    Archive: "Archived",
    Ban: "Banned",
    Create: "Created",
    Delete: "Deleted",
    Impersonate: "Impersonated",
    Move: "Moved",
    Publish: "Published",
    Purge: "Purged",
    Recover: "Recovered",
    Restore: "Restored",
    Revoke: "Revoked",
    Subscribe: "Subscribed",
    Unban: "Unbanned",
    Unpublish: "Unpublished",
    Unsubscribe: "Unsubscribed",
    Update: "Updated",
};

/** The past tense of an action ("Update" → "Updated"); an unknown action comes back as is. */
export function actionPastTenseLabel(action: string): string {
    return ownValue(actionPastTense, action) ?? action;
}

/**
 * Phrases for a related entry, keyed by the entry's own object type, then the type of the page
 * it's shown on, then its action. A related entry's bare verb ("Updated") doesn't say what was
 * updated; these name it from the page's point of view, and read as a sentence with the entry's
 * other ref after them: the same `TeamMembership` Create reads "Added team member <person>" on
 * the Team's history and "Added to team <team>" on the Person's.
 */
const relatedActionPhrases: Partial<
    Record<LogObjectType, Partial<Record<LogObjectType, Partial<Record<string, string>>>>>
> = {
    TeamMembership: {
        Team: {
            Archive: "Archived team member",
            Create: "Added team member",
            Delete: "Removed team member",
            Recover: "Recovered team member",
            Restore: "Restored team member",
            Update: "Updated team member",
        },
        Person: {
            Archive: "Archived membership of",
            Create: "Added to team",
            Delete: "Removed from team",
            Recover: "Recovered membership of",
            Restore: "Restored membership of",
            Update: "Updated membership of",
        },
    },
};

/**
 * The phrase for a related entry's action on a page of type `pageType`, or `undefined` when there
 * isn't one (the caller then shows the bare action plus a "related: <type>" tag). Takes plain
 * strings for the same reason as `objectTypeLabel`.
 */
export function relatedActionPhrase(
    entryType: string,
    pageType: string,
    action: string,
): string | undefined {
    return ownValue(ownValue(ownValue(relatedActionPhrases, entryType), pageType), action);
}
