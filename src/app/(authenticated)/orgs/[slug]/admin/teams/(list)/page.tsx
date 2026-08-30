/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/teams
 *
 * Empty on purpose — the list itself is rendered by `../(list)/layout.tsx`, which wraps
 * this as `children`. This file exists only to match the bare `/teams` path within the
 * `(list)` route group.
 */

export const metadata = {
    title: `Teams`,
};

export default function TeamsList_Page() {
    return null;
}
