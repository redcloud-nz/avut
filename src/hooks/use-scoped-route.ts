/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useCallback } from "react";

import { useCurrentScope } from "@/hooks/use-current-scope";
import {
    scopedRoute,
    type OrgPattern,
    type ScopedRouteParams,
    type TeamPattern,
} from "@/lib/scoped-routes";

/** `scopedRoute` bound to the current scope. Throws outside the org and team scopes. */
export function useScopedRoute() {
    const current = useCurrentScope();
    if (current?.scope !== "organization" && current?.scope !== "team")
        throw new Error("useScopedRoute must be used inside an organization or team scope");
    const { scope, slug } = current;

    // Generic so each call keeps `scopedRoute`'s per-pattern typing of `params`.
    return useCallback(
        <O extends OrgPattern, T extends TeamPattern>(
            patterns: { organization: O; team: T },
            params: ScopedRouteParams<O, T>,
        ) => scopedRoute({ scope, slug }, patterns, params),
        [scope, slug],
    );
}
