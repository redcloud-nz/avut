/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/**
 * Evaluated once when this module is first imported — at build time for a prerendered page —
 * rather than during render.
 *
 * This has to stay out of the render path. `new Date()` is an unstable value under Cache
 * Components: called while rendering, it makes the output unprerenderable, and in a Client
 * Component it's a hard build error. That error was invisible for as long as a `<Suspense>`
 * boundary sat above the landing page absorbing it — see docs/reviews/suspense-boundaries.md §3.
 *
 * A copyright footer only needs the year of the deployment, so build time is the right moment.
 */
const COPYRIGHT_YEAR = new Date().getFullYear();

export function CopyrightString() {
    return <span>&copy; {COPYRIGHT_YEAR} A.V.U.T. Project.</span>;
}
