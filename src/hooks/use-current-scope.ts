/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { usePathname } from "next/navigation";

type UseCurrentScopeResult =
    | { scope: "organization"; slug: string }
    | { scope: "user" }
    | { scope: "system" }
    | null;

/** Which of the three scope roots the current pathname is inside, or `null` for a route above all of them. */
export function useCurrentScope(): UseCurrentScopeResult {
    const pathname = usePathname();
    if (pathname.startsWith("/orgs/"))
        return { scope: "organization", slug: pathname.split("/")[2] };
    if (pathname === "/user" || pathname.startsWith("/user/")) return { scope: "user" };
    if (pathname === "/system" || pathname.startsWith("/system/")) return { scope: "system" };
    return null;
}
