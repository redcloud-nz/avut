/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import { ObjectIcons } from "@/components/icons";
import { EntityActionMenu, type MenuActionProps } from "@/components/ui/menu-action";
import { useHasPermission } from "@/hooks/use-has-permission";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { PersonRef } from "@/lib/schemas/person";
import { TeamData } from "@/lib/schemas/team";

import { AdminModule_RemoveTeamMember_Dialog } from "./remove-team-member";

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

    const actions: MenuActionProps[] = [
        {
            verb: "delete",
            label: "Remove from team",
            icon: <ObjectIcons.Delete />,
            onSelect: () => void setAction("remove", { history: "push" }),
            disabled: !canDelete,
            destructive: true,
        },
    ];

    return (
        <>
            <EntityActionMenu actions={actions} category="Team membership" width="w-44" />

            <AdminModule_RemoveTeamMember_Dialog
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
