/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { TeamData } from "@/lib/schemas/team";

import { EntityLink } from "./entity-link";

export type TeamLinkProps = {
    team: Pick<TeamData, "id" | "name"> & Partial<Pick<TeamData, "description">>;
};

export function TeamLink({ team }: TeamLinkProps) {
    const organization = useOrganization();

    return (
        <EntityLink
            href={route("/orgs/[slug]/admin/teams/[team_id]", {
                slug: organization.slug,
                team_id: team.id,
            })}
            title={team.name}
            type="Team"
        >
            {team.description && <span className="text-muted-foreground">{team.description}</span>}
        </EntityLink>
    );
}
