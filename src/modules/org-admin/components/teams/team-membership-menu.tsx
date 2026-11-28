/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import { ObjectIcons } from "@/components/icons";
import { Teams_RemoveTeamMember_Dialog } from "@/components/teams/remove-team-member";
import { type MenuActionProps } from "@/components/ui/menu-action";
import { RecordCardMenu } from "@/components/ui/record-card-actions";
import { useHasPermission } from "@/hooks/use-has-permission";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { PersonRef } from "@/lib/schemas/person";
import { TeamData } from "@/lib/schemas/team";

/**
 * The Membership card's ⋮ (the page's primary record card): Remove from team, for a viewer with
 * `team: ["delete"]`. Mounts its dialog, which goes back to the team's members on success.
 */
export function AdminModule_TeamMembership_Menu({
    team,
    person,
}: {
    team: TeamData;
    person: PersonRef;
}) {
    const organization = useOrganization();
    const router = useRouter();

    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["remove"] as const));
    const canDelete = useHasPermission({ team: ["delete"] });

    const actions: MenuActionProps[] = [];
    if (canDelete) {
        actions.push({
            verb: "delete",
            label: "Remove from team",
            icon: <ObjectIcons.Delete />,
            onSelect: () => void setAction("remove", { history: "push" }),
            destructive: true,
        });
    }

    return (
        <>
            <RecordCardMenu actions={actions} category="Team membership" primary />

            <Teams_RemoveTeamMember_Dialog
                organizationId={organization.id}
                team={team}
                person={person}
                open={action === "remove"}
                onOpenChange={(open) =>
                    void setAction(open ? "remove" : null, {
                        history: open ? "push" : "replace",
                    })
                }
                onRemoved={() =>
                    router.push(
                        route("/orgs/[slug]/admin/teams/[team_id]/members", {
                            slug: organization.slug,
                            team_id: team.id,
                        }),
                    )
                }
            />
        </>
    );
}
