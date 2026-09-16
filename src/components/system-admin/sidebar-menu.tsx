/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { NavSubItem } from "@/components/nav/nav-section";

/** Nested pages for the System Admin module's `NavCollapsible` section — not a standalone sidebar group. */
export function SystemAdmin_Sidebar_Menu() {
    return (
        <>
            <NavSubItem label="Organisations" href="/system/admin/organizations" />
            <NavSubItem label="Users" href="/system/admin/users" />
            <NavSubItem label="Skill Packages" href="/system/admin/skill-packages" />
        </>
    );
}
