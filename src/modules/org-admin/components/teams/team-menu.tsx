/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import { ObjectIcons } from "@/components/icons";
import { Teams_AddTeamMembership_Dialog } from "@/components/teams/add-team-membership";
import { Teams_D4HMenuGroup } from "@/components/teams/d4h-link-card";
import {
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { EntityActionMenu, type MenuActionProps } from "@/components/ui/menu-action";
import { useHasPermission } from "@/hooks/use-has-permission";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { TeamData } from "@/lib/schemas/team";

import { AdminModule_ArchiveTeam_Dialog } from "./archive-team";
import { AdminModule_DeleteTeam_Dialog } from "./delete-team";
import { AdminModule_RecoverTeam_Dialog } from "./recover-team";
import { AdminModule_RestoreTeam_Dialog } from "./restore-team";

interface AdminModule_TeamMenuProps {
    team: TeamData;
}

const ACTIONS = [
    "update",
    "delete",
    "d4h-link",
    "d4h-sync",
    "d4h-unlink",
    "add-membership",
    "archive",
    "restore",
    "recover",
] as const;

export function AdminModule_Team_Menu({ team }: AdminModule_TeamMenuProps) {
    const [action, setAction] = useQueryState("action", parseAsStringLiteral(ACTIONS));

    const organization = useOrganization();
    const canUpdate = useHasPermission({ team: ["update"] });
    const canDelete = useHasPermission({ team: ["delete"] });
    const isActive = team.status === "Active";

    const actions: MenuActionProps[] = [
        {
            verb: "update",
            label: "Edit",
            icon: <ObjectIcons.Edit />,
            onSelect: () => setAction("update", { history: "push" }),
            disabled: !canUpdate,
        },
    ];
    if (isActive) {
        actions.push({
            verb: "create",
            label: "Add person",
            icon: <ObjectIcons.Create />,
            onSelect: () => setAction("add-membership", { history: "push" }),
            disabled: !canUpdate,
        });
    }
    if (isActive) {
        actions.push({
            verb: "archive",
            label: "Archive",
            icon: <ObjectIcons.Archive />,
            onSelect: () => setAction("archive", { history: "push" }),
            disabled: !canUpdate,
        });
    } else if (team.status === "Archived") {
        actions.push({
            verb: "restore",
            label: "Restore",
            icon: <ObjectIcons.Restore />,
            onSelect: () => setAction("restore", { history: "push" }),
            disabled: !canUpdate,
        });
    } else {
        actions.push({
            verb: "recover",
            label: "Recover from rubbish",
            icon: <ObjectIcons.Recover />,
            onSelect: () => setAction("recover", { history: "push" }),
            disabled: !canDelete,
        });
    }
    if (team.status !== "Deleted") {
        actions.push({
            verb: "delete",
            label: "Delete",
            icon: <ObjectIcons.Delete />,
            onSelect: () => setAction("delete", { history: "push" }),
            disabled: !canDelete,
            destructive: true,
        });
    }

    return (
        <>
            <EntityActionMenu
                actions={actions}
                category="Teams"
                before={
                    <>
                        <DropdownMenuGroup>
                            <DropdownMenuItem asChild>
                                <Link
                                    href={route("/orgs/[slug]/admin/teams/[team_id]/history", {
                                        slug: organization.slug,
                                        team_id: team.id,
                                    })}
                                >
                                    <ObjectIcons.History /> History
                                </Link>
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                    </>
                }
                after={<Teams_D4HMenuGroup team={team} setAction={setAction} />}
            />

            <AdminModule_DeleteTeam_Dialog
                team={team}
                open={action === "delete"}
                onOpenChange={(open) =>
                    void setAction(open ? "delete" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />

            <Teams_AddTeamMembership_Dialog
                team={team}
                open={action === "add-membership"}
                onOpenChange={(open) =>
                    void setAction(open ? "add-membership" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />

            <AdminModule_ArchiveTeam_Dialog
                team={team}
                open={action === "archive"}
                onOpenChange={(open) =>
                    void setAction(open ? "archive" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />

            <AdminModule_RestoreTeam_Dialog
                team={team}
                open={action === "restore"}
                onOpenChange={(open) =>
                    void setAction(open ? "restore" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />

            <AdminModule_RecoverTeam_Dialog
                team={team}
                open={action === "recover"}
                onOpenChange={(open) =>
                    void setAction(open ? "recover" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />
        </>
    );
}
