import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderHook } from "@testing-library/react";

import { useCurrentScope } from "./use-current-scope";

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

describe("useCurrentScope", () => {
    beforeEach(() => {
        pathname = "/";
    });

    it.each([
        ["/teams/x", { scope: "team", slug: "x" }],
        ["/teams/x/y", { scope: "team", slug: "x" }],
        ["/orgs/x", { scope: "organization", slug: "x" }],
        ["/user", { scope: "user" }],
        ["/system/admin", { scope: "system" }],
        ["/tools", null],
    ])("%s", (path, expected) => {
        pathname = path;
        expect(renderHook(() => useCurrentScope()).result.current).toEqual(expected);
    });
});
