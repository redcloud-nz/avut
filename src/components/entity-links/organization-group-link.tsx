/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { route } from "@/lib/routes";
import { OrganizationGroupRef } from "@/lib/schemas/organization-group";

import { EntityLink } from "./entity-link";

export type OrganizationGroupLinkProps = {
    group: OrganizationGroupRef;
};

/** Links to the system-admin group detail page. */
export function OrganizationGroupLink({ group }: OrganizationGroupLinkProps) {
    return (
        <EntityLink
            href={route("/system/admin/groups/[groupId]", { groupId: group.id })}
            title={group.name}
            type="Organisation Group"
        />
    );
}
