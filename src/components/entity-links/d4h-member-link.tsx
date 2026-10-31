/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { D4HMemberRef } from "@/lib/schemas/d4h/member";

import { EntityLink } from "./entity-link";

export type D4HMemberLinkProps = {
    /**
     * A `null` name means the member isn't in the team's member list (retired, or the list failed
     * to load), so there's no page to link to: it renders as plain `Member #<id>`.
     */
    member: Omit<D4HMemberRef, "name"> & { name: string | null };
};

export function D4HMemberLink({ member }: D4HMemberLinkProps) {
    const organization = useOrganization();

    if (member.name === null) return <>Member #{member.id}</>;

    return (
        <EntityLink
            href={route("/orgs/[slug]/d4h/teams/[d4h_team_id]/members/[member_id]", {
                slug: organization.slug,
                d4h_team_id: String(member.owner.id),
                member_id: String(member.id),
            })}
            title={member.name}
            type="D4H Member"
        />
    );
}
