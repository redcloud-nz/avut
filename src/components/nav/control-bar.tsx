/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { OrganizationData } from "@/lib/schemas/organization";

import { NotificationsMenu } from "./notifications-menu";
import { UserMenu } from "./user-menu";

export function ControlBar({
    organization,
}: {
    organization: OrganizationData;
}) {
    return (
        <div
            data-slot="control-bar"
            className="fixed top-0 right-0 z-10 h-[calc(var(--header-height)-1px)] flex items-center gap-2 px-2"
        >
            <NotificationsMenu />
            <UserMenu organization={organization} />
        </div>
    );
}
