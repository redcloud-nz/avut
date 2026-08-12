/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { TRPCClientError } from "@trpc/client";

import { describeError, ErrorDescriptions } from "./describe-error";

/**
 * Build a TRPCClientError the way the httpBatchLink does — from a JSON-RPC error response.
 * `data.code` is the string code, which is what `describeError` keys off.
 */
function trpcError(code: string, message = "boom") {
    return TRPCClientError.from({
        error: { message, code: -32603, data: { code, httpStatus: 403 } },
    });
}

describe("describeError", () => {
    it("maps FORBIDDEN to the permission description", () => {
        expect(describeError(trpcError("FORBIDDEN"))).toEqual(ErrorDescriptions.Forbidden);
    });

    it("maps NOT_FOUND to the not-found description", () => {
        expect(describeError(trpcError("NOT_FOUND"))).toEqual(ErrorDescriptions.NotFound);
    });

    it("maps UNAUTHORIZED to the signed-out description", () => {
        expect(describeError(trpcError("UNAUTHORIZED"))).toEqual(ErrorDescriptions.Unauthorized);
    });

    it("falls back to the error's own name and message", () => {
        const result = describeError(new TypeError("x is not a function"));

        expect(result).toEqual({
            title: "TypeError",
            description: "x is not a function",
            pose: "Error",
        });
    });

    // Next strips server-component error messages in production, leaving an empty string.
    it("supplies generic copy when the message is empty", () => {
        const result = describeError(new Error(""));

        expect(result.title).toBe("Error");
        expect(result.description).toBe("An unexpected error occurred.");
        expect(result.pose).toBe("Error");
    });

    it("handles a thrown non-Error", () => {
        const result = describeError("just a string");

        expect(result).toEqual({
            title: "Error",
            description: "An unexpected error occurred.",
            pose: "Error",
        });
    });

    // An unrecognised tRPC code is not special — it gets the generic treatment.
    it("falls back for an unmapped tRPC code", () => {
        expect(describeError(trpcError("INTERNAL_SERVER_ERROR", "db down")).description).toBe(
            "db down",
        );
    });
});
