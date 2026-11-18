/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { UserData, UserRef } from "@/lib/schemas/user";

import { EntityLink } from "./entity-link";

export type OrgUserLinkProps = {
    user: UserRef & Partial<Pick<UserData, "email">>;
};

/**
 * A user's name, linking to their page in the current organization's admin
 * (`/orgs/[slug]/admin/users/[user_id]`). `UserLink` goes to the system admin page instead.
 */
export function OrgUserLink({ user }: OrgUserLinkProps) {
    const organization = useOrganization();

    return (
        <EntityLink
            href={route("/orgs/[slug]/admin/users/[user_id]", {
                slug: organization.slug,
                user_id: user.id,
            })}
            title={user.name}
            type="User"
        >
            {user.email && <span className="text-muted-foreground">{user.email}</span>}
        </EntityLink>
    );
}
