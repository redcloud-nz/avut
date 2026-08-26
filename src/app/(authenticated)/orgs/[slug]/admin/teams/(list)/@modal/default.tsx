/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Fallback for the `modal` slot on any route under `(list)` that isn't itself a modal
 * (currently just `/orgs/[slug]/admin/teams`) — no dialog open.
 */

export default function TeamsModal_Default() {
    return null;
}
