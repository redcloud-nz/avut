/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * PROTOTYPE — root fallback for the lifted `@sidebar` slot: any authenticated route with no
 * more specific slot match (`/user/profile`, `/modules`, `/orgs/--create`,
 * `/orgs/--select-org`, …). The `ScopeSwitcher` in the authenticated layout is always
 * rendered above this slot, so these routes are never left without any nav at all.
 */

export default function Sidebar_Default() {
    return null;
}
