/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRef } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Protect } from "@/components/protect";
import { Teams_D4HCard, Teams_D4HLink_ActionsCard } from "@/components/teams/d4h-link-card";
import { Teams_TeamAccess_Card } from "@/components/teams/team-access-card";
import { Teams_Details_Card } from "@/components/teams/team-details-card";
import { RecordStatusBadge } from "@/components/ui/status-badge";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { TeamId } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

import { AdminModule_TeamLinks_Card } from "./team-links";
import { AdminModule_Team_Menu } from "./team-menu";

export function AdminModule_Team_Content({ teamId }: { teamId: TeamId }) {
    const organization = useOrganization();

    const { data: team } = useSuspenseQuery(
        trpc.teams.getTeam.queryOptions({ organizationId: organization.id, teamId }),
    );

    // The Team card's pencil: where the D4H dialogs return focus once their button is gone.
    const editButtonRef = useRef<HTMLButtonElement>(null);

    return (
        <Saratoga.Root>
            <Saratoga.Breadcrumbs
                items={[
                    {
                        label: "Teams",
                        href: route("/orgs/[slug]/admin/teams", { slug: organization.slug }),
                    },
                ]}
            />
            <Saratoga.Header>
                <Saratoga.Title badges={<RecordStatusBadge status={team.status} />}>
                    {team.name}
                </Saratoga.Title>
            </Saratoga.Header>

            <Saratoga.Columns>
                <Saratoga.Column slot="main">
                    <Teams_Details_Card
                        team={team}
                        historyHref={route("/orgs/[slug]/admin/teams/[team_id]/history", {
                            slug: organization.slug,
                            team_id: team.id,
                        })}
                        triggerRef={editButtonRef}
                        menu={<AdminModule_Team_Menu team={team} />}
                    />

                    <Protect permissions={{ member: ["view"] }}>
                        <Teams_TeamAccess_Card team={team} />
                    </Protect>

                    <Teams_D4HCard team={team} returnFocusRef={editButtonRef} />
                </Saratoga.Column>

                <Saratoga.Column slot="secondary">
                    <Teams_D4HLink_ActionsCard team={team} />
                    <AdminModule_TeamLinks_Card team={team} />
                </Saratoga.Column>
            </Saratoga.Columns>
        </Saratoga.Root>
    );
}
