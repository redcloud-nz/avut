/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { afterEach, describe, expect, it } from "vitest";

import { env } from "./env";

describe("env", () => {
    afterEach(() => {
        delete process.env.VERCEL_ENV;
        delete process.env.PORT;
    });

    it("reads the variable at access time, not import time", () => {
        expect(env.VERCEL_ENV).toBeUndefined();
        process.env.VERCEL_ENV = "preview";
        expect(env.VERCEL_ENV).toBe("preview");
    });

    it("treats an empty string as unset", () => {
        process.env.PORT = "";
        expect(env.PORT).toBeUndefined();
    });
});
