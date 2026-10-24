/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { D4HTeamRef } from "@/lib/schemas/d4h/team";

import { EntityLink } from "./entity-link";

export type D4HTeamLinkProps = {
    team: D4HTeamRef;
};

export function D4HTeamLink({ team }: D4HTeamLinkProps) {
    const organization = useOrganization();

    return (
        <EntityLink
            href={route("/orgs/[slug]/d4h/teams/[d4h_team_id]", {
                slug: organization.slug,
                d4h_team_id: String(team.id),
            })}
            title={team.title}
            type="D4H Team"
        />
    );
}
