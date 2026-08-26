/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Fallback for the `children` slot on any route under `(list)` other than the bare list
 * itself (`page.tsx`) — currently `/orgs/[slug]/admin/teams/--create`, which only has a
 * page in the `modal` slot. Without this, a direct load/refresh of that URL would 404 the
 * `children` slot instead of quietly rendering nothing.
 */

export default function TeamsList_Default() {
    return null;
}
