/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

type Issue = Parameters<NonNullable<z.core.$ZodConfig["customError"]>>[0];

const Units: Partial<Record<string, [singular: string, plural: string]>> = {
    string: ["character", "characters"],
    array: ["item", "items"],
    set: ["item", "items"],
};

const Formats: Partial<Record<string, string>> = {
    email: "Enter a valid email address",
    url: "Enter a valid URL",
    datetime: "Enter a valid date and time",
    date: "Enter a valid date",
    time: "Enter a valid time",
};

function isEmpty(input: unknown) {
    return input === undefined || input === null || input === "";
}

function count(n: number | bigint, origin: string) {
    const [singular, plural] = Units[origin]!;
    return `${n} ${n == 1 ? singular : plural}`;
}

/**
 * Plain-English messages for the issues a form can produce, in place of Zod's diagnostic wording
 * ("Too small: expected string to have >=1 characters"). Importing this module registers it
 * with `z.config`, which is global: `ClientProvider` imports it for the browser, `src/trpc/init.ts`
 * for the server.
 *
 * A message on the schema itself (`z.number({ error: "Enter a number of months" })`) still wins:
 * Zod only falls through to the global map when a schema sets none. Anything not covered here
 * returns `undefined`, which keeps Zod's own message: a value of the wrong type from an API, an
 * unrecognized key or a failed union is a developer's problem, and the diagnostic is what they
 * need in the log.
 */
export function zodErrorMap(issue: Issue): string | undefined {
    // An empty text field is missing, whatever rule it then fails: "Required" over
    // "Must be at least 5 characters" or "Enter a valid email address".
    if (issue.input === "" && (issue.code === "too_small" || issue.code === "invalid_format")) {
        return "Required";
    }

    switch (issue.code) {
        case "invalid_type":
            if (isEmpty(issue.input)) return "Required";
            if (issue.expected === "number" || issue.expected === "int") {
                // A cleared number input holds NaN (see `numberInputProps`).
                if (typeof issue.input === "number" && Number.isNaN(issue.input)) {
                    return "Enter a number";
                }
                if (issue.expected === "int" && typeof issue.input === "number") {
                    return "Enter a whole number";
                }
            }
            if (issue.expected === "date" && issue.input instanceof Date)
                return "Enter a valid date";
            return undefined;

        case "too_small": {
            const { minimum, inclusive, exact, origin } = issue;
            if (origin === "string" || origin === "array" || origin === "set") {
                if (exact) return `Must be exactly ${count(minimum, origin)}`;
                if (minimum == 1 && inclusive && origin !== "string") return "Add at least one";
                return `Must be at least ${count(minimum, origin)}`;
            }
            if (origin === "number" || origin === "int" || origin === "bigint") {
                return inclusive ? `Must be at least ${minimum}` : `Must be more than ${minimum}`;
            }
            if (origin === "date") return "Date is too early";
            return undefined;
        }

        case "too_big": {
            const { maximum, inclusive, exact, origin } = issue;
            if (origin === "string" || origin === "array" || origin === "set") {
                if (exact) return `Must be exactly ${count(maximum, origin)}`;
                return `Must be at most ${count(maximum, origin)}`;
            }
            if (origin === "number" || origin === "int" || origin === "bigint") {
                return inclusive ? `Must be at most ${maximum}` : `Must be less than ${maximum}`;
            }
            if (origin === "date") return "Date is too late";
            return undefined;
        }

        case "invalid_format":
            if (issue.format === "starts_with") return `Must start with "${issue.prefix}"`;
            if (issue.format === "ends_with") return `Must end with "${issue.suffix}"`;
            if (issue.format === "includes") return `Must include "${issue.includes}"`;
            if (issue.format === "regex") return "Not in the expected format";
            // ID formats (uuid, nanoid, …) aren't typed by people; keep Zod's message for those.
            return Formats[issue.format];

        case "invalid_value":
            return issue.values.length > 1 ? "Choose one of the options" : undefined;

        case "not_multiple_of":
            return `Must be a multiple of ${issue.divisor}`;

        default:
            return undefined;
    }
}

z.config({ customError: zodErrorMap });
