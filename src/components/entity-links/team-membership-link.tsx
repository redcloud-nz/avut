/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { PersonId } from "@/lib/schemas/person";
import { TeamId } from "@/lib/schemas/team";

import { EntityLink } from "./entity-link";

export type TeamMembershipLinkProps = {
    teamMembership: {
        teamId: TeamId;
        personId: PersonId;
        name: string;
    };
};

export function TeamMembershipLink({ teamMembership }: TeamMembershipLinkProps) {
    const organization = useOrganization();

    return (
        <EntityLink
            href={route("/orgs/[slug]/admin/teams/[team_id]/members/[person_id]", {
                slug: organization.slug,
                team_id: teamMembership.teamId,
                person_id: teamMembership.personId,
            })}
            title={teamMembership.name}
            type="Team Membership"
        />
    );
}
