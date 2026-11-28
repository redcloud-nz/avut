/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/**
 * One CSV cell. Answers come from anyone with the link, so a value a spreadsheet would read as a
 * formula (`=`, `+`, `-`, `@`, or a tab or return first) gets a leading `'`, which keeps it as
 * text; then cells with quotes, commas or line breaks are quoted.
 */
export function csvCell(value: string): string {
    const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}
