/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { NavSubItem } from "@/components/nav/nav-section";

/** Nested pages for the User Settings module's `NavCollapsible` section — not a standalone sidebar group. */
export function Profile_Sidebar_Menu() {
    return (
        <>
            <NavSubItem label="Account" href="/user/settings/account" />
            <NavSubItem label="Organisations" href="/user/settings/organizations" />
            <NavSubItem label="D4H" href="/user/settings/d4h" />
            <NavSubItem label="Preferences" href="/user/settings/preferences" />
        </>
    );
}
