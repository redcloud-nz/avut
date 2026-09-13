/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * PROTOTYPE — root fallback for the lifted `@sidebar` slot: any authenticated route with no
 * more specific slot match (`/user-settings`, `/modules`, `/orgs/--create`,
 * `/orgs/--select-org`, …). No org or global module switcher here — `OrgModuleListMenu` only
 * covers the org scope, and none of these routes are inside one.
 */

export default function Sidebar_Default() {
    return null;
}
