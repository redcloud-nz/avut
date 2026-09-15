/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import { DropdownMenuTriggerIcon, ObjectIcons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
    const canUpdate = useHasPermission({ team: ["update"] });

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <DropdownMenuTriggerIcon />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-44" align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem
                        disabled={!canUpdate}
                        className="text-destructive focus:text-destructive"
                        onClick={() => void setAction("remove", { history: "push" })}
                    >
                        <ObjectIcons.Delete /> Remove from team
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

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
                        route("/orgs/[slug]/admin/teams/[team_id]/personnel", {
                            slug: organization.slug,
                            team_id: team.id,
                        }),
                    )
                }
            />
        </>
    );
}
