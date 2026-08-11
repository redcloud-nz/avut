/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { postSignInUrl, safeRedirectPath, signInUrl } from "./auth-redirect";

describe("safeRedirectPath", () => {
    it("accepts same-origin relative paths", () => {
        expect(safeRedirectPath("/orgs/acme/admin")).toBe("/orgs/acme/admin");
        expect(safeRedirectPath("/orgs/acme/admin?tab=teams")).toBe("/orgs/acme/admin?tab=teams");
        expect(safeRedirectPath("/")).toBe("/");
    });

    it("rejects empty input", () => {
        expect(safeRedirectPath(undefined)).toBeNull();
        expect(safeRedirectPath(null)).toBeNull();
        expect(safeRedirectPath("")).toBeNull();
    });

    it("rejects absolute and protocol-relative URLs", () => {
        expect(safeRedirectPath("https://evil.example")).toBeNull();
        expect(safeRedirectPath("http://evil.example/orgs")).toBeNull();
        expect(safeRedirectPath("//evil.example")).toBeNull();
        expect(safeRedirectPath("/\\evil.example")).toBeNull();
        expect(safeRedirectPath("javascript:alert(1)")).toBeNull();
    });

    it("rejects values that are not paths", () => {
        expect(safeRedirectPath("orgs/acme")).toBeNull();
    });
});

describe("signInUrl", () => {
    it("encodes a valid return path", () => {
        expect(signInUrl("/orgs/acme/admin?tab=teams")).toBe(
            "/auth/sign-in?redirectTo=%2Forgs%2Facme%2Fadmin%3Ftab%3Dteams",
        );
    });

    it("falls back to the bare sign-in path for missing or unsafe input", () => {
        expect(signInUrl(undefined)).toBe("/auth/sign-in");
        expect(signInUrl(null)).toBe("/auth/sign-in");
        expect(signInUrl("//evil.example")).toBe("/auth/sign-in");
        expect(signInUrl("https://evil.example")).toBe("/auth/sign-in");
    });
});

describe("postSignInUrl", () => {
    it("encodes a valid return path", () => {
        expect(postSignInUrl("/modules")).toBe("/auth/post-sign-in?redirectTo=%2Fmodules");
    });

    it("falls back to the bare post-sign-in path for unsafe input", () => {
        expect(postSignInUrl("https://evil.example")).toBe("/auth/post-sign-in");
    });
});
