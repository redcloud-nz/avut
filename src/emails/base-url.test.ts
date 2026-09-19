/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { resolveBaseUrl } from "./base-url";

describe("resolveBaseUrl", () => {
    it("links to the production domain in production, not the per-deployment host", () => {
        expect(
            resolveBaseUrl({
                VERCEL_ENV: "production",
                VERCEL_URL: "avut-abc123-redcloud.vercel.app",
                VERCEL_PROJECT_PRODUCTION_URL: "www.avut.nz",
            }),
        ).toBe("https://www.avut.nz");
    });

    it("still links to the production domain if the production URL variable is missing", () => {
        expect(
            resolveBaseUrl({
                VERCEL_ENV: "production",
                VERCEL_URL: "avut-abc123-redcloud.vercel.app",
            }),
        ).toBe("https://www.avut.nz");
    });

    it("links a preview deployment back to itself, even though a production domain exists", () => {
        expect(
            resolveBaseUrl({
                VERCEL_ENV: "preview",
                VERCEL_URL: "avut-git-feature-redcloud.vercel.app",
                VERCEL_PROJECT_PRODUCTION_URL: "www.avut.nz",
            }),
        ).toBe("https://avut-git-feature-redcloud.vercel.app");
    });

    it("falls back to the local dev server when nothing Vercel is set", () => {
        expect(resolveBaseUrl({})).toBe("http://localhost:3000");
    });
});
