/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { formatTrpcError } from "./error-formatter";
import { FieldConflictError } from "./errors";

const forbiddenShape = {
    message: 'Insufficient permissions. Action requires: {"person":["view"]}',
    code: -32603,
    data: { code: "FORBIDDEN", httpStatus: 403, path: "personnel.getPerson" },
};

describe("formatTrpcError", () => {
    // The client error mapper keys off `data.code`. Spreading the whole shape into `data`
    // — as the original formatter did — replaces the string code with tRPC's numeric one
    // and pushes the string down to `data.data.code`, where nothing looks for it.
    it("preserves the string error code at data.code", () => {
        const result = formatTrpcError({ shape: forbiddenShape, error: { code: "FORBIDDEN" } });

        expect(result.data.code).toBe("FORBIDDEN");
        expect(result.data.httpStatus).toBe(403);
    });

    it("attaches conflict details for a CONFLICT caused by a FieldConflictError", () => {
        const cause = new FieldConflictError("email", "That email is already in use.");

        const result = formatTrpcError({
            shape: { message: "conflict", code: -32603, data: { code: "CONFLICT" } },
            error: { code: "CONFLICT", cause },
        });

        expect(result.data.conflict).toEqual({
            fieldName: "email",
            message: "That email is already in use.",
        });
    });

    it("leaves conflict undefined when the error is not a field conflict", () => {
        const result = formatTrpcError({ shape: forbiddenShape, error: { code: "FORBIDDEN" } });

        expect(result.data.conflict).toBeUndefined();
    });

    // A CONFLICT raised without a FieldConflictError cause has no field to report.
    it("leaves conflict undefined for a CONFLICT with an unrelated cause", () => {
        const result = formatTrpcError({
            shape: { message: "conflict", code: -32603, data: { code: "CONFLICT" } },
            error: { code: "CONFLICT", cause: new Error("something else") },
        });

        expect(result.data.conflict).toBeUndefined();
    });
});
