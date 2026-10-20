/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";
import * as z from "zod";

import "./zod-error-map";

function messageFor(schema: z.ZodType, input: unknown) {
    const result = schema.safeParse(input);
    if (result.success) throw new Error(`Expected ${JSON.stringify(input)} to fail`);
    return result.error.issues[0].message;
}

describe("zodErrorMap", () => {
    it("reports a missing or empty value as Required", () => {
        expect(messageFor(z.string(), undefined)).toBe("Required");
        expect(messageFor(z.number(), null)).toBe("Required");
        expect(messageFor(z.string().min(1), "")).toBe("Required");
        expect(messageFor(z.object({ name: z.string() }), {})).toBe("Required");
        expect(messageFor(z.string().min(5), "")).toBe("Required");
        expect(messageFor(z.email(), "")).toBe("Required");
    });

    it("describes number problems", () => {
        expect(messageFor(z.number(), NaN)).toBe("Enter a number");
        expect(messageFor(z.number().int(), NaN)).toBe("Enter a number");
        expect(messageFor(z.number().int(), 1.5)).toBe("Enter a whole number");
        expect(messageFor(z.number().min(1), 0)).toBe("Must be at least 1");
        expect(messageFor(z.number().positive(), 0)).toBe("Must be more than 0");
        expect(messageFor(z.number().max(48), 49)).toBe("Must be at most 48");
        expect(messageFor(z.number().lt(10), 10)).toBe("Must be less than 10");
        expect(messageFor(z.number().multipleOf(15), 20)).toBe("Must be a multiple of 15");
    });

    it("describes length problems with the right unit", () => {
        expect(messageFor(z.string().min(3), "ab")).toBe("Must be at least 3 characters");
        expect(messageFor(z.string().max(1), "ab")).toBe("Must be at most 1 character");
        expect(messageFor(z.string().length(4), "ab")).toBe("Must be exactly 4 characters");
        expect(messageFor(z.array(z.string()).min(1), [])).toBe("Add at least one");
        expect(messageFor(z.array(z.string()).max(2), ["a", "b", "c"])).toBe(
            "Must be at most 2 items",
        );
    });

    it("describes formats a person types", () => {
        expect(messageFor(z.email(), "nope")).toBe("Enter a valid email address");
        expect(messageFor(z.url(), "nope")).toBe("Enter a valid URL");
        expect(messageFor(z.string().regex(/^[a-z]+$/), "A")).toBe("Not in the expected format");
        expect(messageFor(z.string().startsWith("ab"), "x")).toBe('Must start with "ab"');
        expect(messageFor(z.enum(["a", "b"]), "c")).toBe("Choose one of the options");
    });

    it("keeps Zod's diagnostic for problems a form can't produce", () => {
        expect(messageFor(z.string(), 42)).toBe("Invalid input: expected string, received number");
        expect(messageFor(z.uuid(), "nope")).toBe("Invalid UUID");
        expect(messageFor(z.strictObject({}), { extra: 1 })).toBe('Unrecognized key: "extra"');
    });

    it("gives way to a message set on the schema", () => {
        const months = z.number({ error: "Enter a number of months" }).int("Whole months only");
        expect(messageFor(months, NaN)).toBe("Enter a number of months");
        expect(messageFor(months, 1.5)).toBe("Whole months only");
        expect(messageFor(z.string().min(1, "Enter a name"), "")).toBe("Enter a name");
    });
});
