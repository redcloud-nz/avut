/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/**
 * Matching pathnames against typed-route patterns (`/orgs/[slug]/admin/teams/[team_id]`), the
 * path under `src/app/` minus route groups. A `[param]` segment matches any one segment; every
 * other segment must be equal. Catch-all segments (`[...x]`, `[[...x]]`) aren't supported and
 * throw, so adding one is a deliberate change.
 *
 * Client-safe: Help cards use it to find the card for the current page.
 */

function splitPathname(pathname: string): string[] {
    const path = pathname.split(/[?#]/, 1)[0];
    return path.split("/").filter((segment) => segment !== "");
}

function isParam(segment: string): boolean {
    return segment.startsWith("[") && segment.endsWith("]");
}

function splitPattern(pattern: string): string[] {
    const segments = splitPathname(pattern);
    for (const segment of segments) {
        if (segment.startsWith("[...") || segment.startsWith("[[...")) {
            throw new Error(`Catch-all route patterns are not supported: ${pattern}`);
        }
    }
    return segments;
}

function matchSegments(patternSegments: string[], pathSegments: string[]): boolean {
    if (patternSegments.length !== pathSegments.length) return false;
    return patternSegments.every((segment, i) => isParam(segment) || segment === pathSegments[i]);
}

/** A help card's id and the route patterns it covers (its `routes` frontmatter). */
export type HelpCardRoutes = { id: string; routes: string[] };

/**
 * Whether `pathname` is a page of `pattern`. A trailing slash, query string or hash on
 * `pathname` is ignored.
 */
export function matchesRoutePattern(pattern: string, pathname: string): boolean {
    return matchSegments(splitPattern(pattern), splitPathname(pathname));
}

/**
 * Compare two patterns that match the same pathname (so have equal segment counts): negative
 * when `a` is more specific. At the first segment where one is static and the other `[param]`,
 * the static one wins.
 */
function compareSpecificity(a: string[], b: string[]): number {
    for (let i = 0; i < a.length; i++) {
        const aParam = isParam(a[i]);
        const bParam = isParam(b[i]);
        if (aParam !== bParam) return aParam ? 1 : -1;
    }
    return 0;
}

/**
 * The item whose `routes` holds the most specific pattern matching `pathname`, or `undefined`
 * when none matches. Two items listing equally specific matches is a content error (the
 * coverage test catches it); the first one wins here.
 */
export function mostSpecificMatch<T extends { routes: string[] }>(
    items: readonly T[],
    pathname: string,
): T | undefined {
    const pathSegments = splitPathname(pathname);

    let best: { item: T; segments: string[] } | undefined;
    for (const item of items) {
        for (const pattern of item.routes) {
            const segments = splitPattern(pattern);
            if (!matchSegments(segments, pathSegments)) continue;
            if (!best || compareSpecificity(segments, best.segments) < 0) {
                best = { item, segments };
            }
        }
    }
    return best?.item;
}
