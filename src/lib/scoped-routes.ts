/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import type { Route } from "next";

import type { ScopeRef } from "@/lib/modules";

// eslint-disable-next-line avut/no-deep-relative-imports -- generated types live outside src/, so they have no @/ alias
import type { AppRoutes, ParamMap } from "../../.next/types/routes";

/** A route pattern under the org scope root. */
export type OrgPattern = Extract<AppRoutes, `/orgs/[slug]${string}`>;
/** A route pattern under the team scope root. */
export type TeamPattern = Extract<AppRoutes, `/teams/[slug]${string}`>;

/** The params both patterns take, besides `slug` (which comes from the scope). */
export type ScopedRouteParams<O extends OrgPattern, T extends TeamPattern> = Omit<
    ParamMap[O],
    "slug"
> &
    Omit<ParamMap[T], "slug">;

/**
 * Builds a link inside the org or team scope root named by `ref`, for components used in both.
 * Picks the pattern for the ref's scope and fills `slug` from the ref; `params` holds the
 * patterns' other params. Both roots name their param `[slug]`, so both stay typed routes.
 */
export function scopedRoute<O extends OrgPattern, T extends TeamPattern>(
    ref: ScopeRef,
    patterns: { organization: O; team: T },
    params: ScopedRouteParams<O, T>,
): Route {
    let path: string = ref.scope === "team" ? patterns.team : patterns.organization;
    // Only single `[key]` segments: neither root has a catch-all page (`route()` doesn't fill
    // `[...key]` either), and typing this as `Record<string, string>` makes one fail to compile here.
    const all: Record<string, string> = { ...params, slug: ref.slug };

    for (const [key, value] of Object.entries(all)) {
        path = path.replace(`[${key}]`, value);
    }

    return path as Route;
}
