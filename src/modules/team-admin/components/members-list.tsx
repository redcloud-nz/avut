/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { useCallback } from "react";

import { useSuspenseQueries } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Teams_AddTeamMembership_Dialog } from "@/components/teams/add-team-membership";
import { Teams_RemoveTeamMember_Dialog } from "@/components/teams/remove-team-member";
import {
    Teams_Members_Table,
    type Teams_MembershipRow,
} from "@/components/teams/team-members-table";
import { Button } from "@/components/ui/button";
import { useOrganization } from "@/hooks/use-organization";
import { useTeam } from "@/hooks/use-team";
import { trpc } from "@/trpc/client";

/**
 * Team admin's roster (`/teams/[slug]/admin/members`): the team's memberships, with **New
 * Member** and a **Remove** button on each row. Owns the `?action=add-membership` and
 * `?action=remove&personId=…` params for their dialogs.
 */
export function TeamAdmin_Members_List() {
    const organization = useOrganization();
    const { id: teamId } = useTeam();

    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["add-membership", "remove"] as const),
    );
    const [personId, setPersonId] = useQueryState("personId", parseAsString);

    const [{ data: team }, { data: memberships }] = useSuspenseQueries({
        queries: [
            trpc.teams.getTeam.queryOptions({ organizationId: organization.id, teamId }),
            trpc.teams.listTeamMemberships.queryOptions({
                organizationId: organization.id,
                teamId,
            }),
        ],
    });

    const removePerson = memberships.find((m) => m.person.id === personId)?.person ?? null;

    const rowAction = useCallback(
        (row: Teams_MembershipRow) => (
            <Protect permissions={{ team: ["delete"] }}>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${row.person.name} from the team`}
                    onClick={() => {
                        void setPersonId(row.person.id, { history: "push" });
                        void setAction("remove", { history: "push" });
                    }}
                >
                    <ObjectIcons.Delete />
                </Button>
            </Protect>
        ),
        [setAction, setPersonId],
    );

    function closeRemove() {
        void setAction(null, { history: "replace" });
        void setPersonId(null, { history: "replace" });
    }

    return (
        <>
            <Saratoga.Root>
                <Saratoga.Header>
                    <Saratoga.Title>Members</Saratoga.Title>
                    <Saratoga.Actions>
                        {team.status === "Active" && (
                            <Protect permissions={{ team: ["update"] }}>
                                <Button
                                    variant="outline"
                                    onClick={() => setAction("add-membership", { history: "push" })}
                                >
                                    <ObjectIcons.Create />{" "}
                                    <span className="sr-only md:not-sr-only">New Member</span>
                                </Button>
                            </Protect>
                        )}
                    </Saratoga.Actions>
                </Saratoga.Header>
                <Teams_Members_Table
                    team={team}
                    memberships={memberships}
                    rowAction={rowAction}
                    linkPeople={false}
                />
            </Saratoga.Root>

            <Teams_AddTeamMembership_Dialog
                team={team}
                open={action === "add-membership"}
                onOpenChange={(open) =>
                    setAction(open ? "add-membership" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />
            {removePerson && (
                <Teams_RemoveTeamMember_Dialog
                    organizationId={organization.id}
                    team={team}
                    person={removePerson}
                    open={action === "remove"}
                    onOpenChange={(open) => (open ? undefined : closeRemove())}
                />
            )}
        </>
    );
}
