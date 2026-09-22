/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { afterEach, describe, expect, it } from "vitest";

import { serverEnv } from "./env";

describe("serverEnv", () => {
    afterEach(() => {
        delete process.env.RESEND_API_KEY;
        delete process.env.NOREPLY_EMAIL;
    });

    it("throws an error naming a required variable that is not set", () => {
        delete process.env.RESEND_API_KEY;
        expect(() => serverEnv.RESEND_API_KEY).toThrow("RESEND_API_KEY");
    });

    it("treats an empty required variable as not set", () => {
        process.env.RESEND_API_KEY = "";
        expect(() => serverEnv.RESEND_API_KEY).toThrow("RESEND_API_KEY");
    });

    it("returns a required variable that is set", () => {
        process.env.RESEND_API_KEY = "re_test";
        expect(serverEnv.RESEND_API_KEY).toBe("re_test");
    });

    it("returns undefined for an optional variable that is unset or empty", () => {
        delete process.env.NOREPLY_EMAIL;
        expect(serverEnv.NOREPLY_EMAIL).toBeUndefined();
        process.env.NOREPLY_EMAIL = "";
        expect(serverEnv.NOREPLY_EMAIL).toBeUndefined();
    });
});
