/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";

import { AdminModule_AddTeamMembership_Dialog } from "@/components/admin/teams/add-team-membership";
import { D4HIcons, ObjectIcons } from "@/components/icons";
import {
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { EntityActionMenu, type MenuActionProps } from "@/components/ui/menu-action";
import { useHasPermission } from "@/hooks/use-has-permission";
import { useOrganization } from "@/hooks/use-organization";
import { TeamData } from "@/lib/schemas/team";

import { AdminModule_ArchiveTeam_Dialog } from "./archive-team";
import { AdminModule_DeleteTeam_Dialog } from "./delete-team";
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
] as const;

export function AdminModule_Team_Menu({ team }: AdminModule_TeamMenuProps) {
    const [action, setAction] = useQueryState("action", parseAsStringLiteral(ACTIONS));

    const d4hEnabled = useOrganization().settings.integrations.d4h.enabled;
    const canUpdate = useHasPermission({ team: ["update"] });
    const canDelete = useHasPermission({ team: ["delete"] });
    const linked = team.d4h !== null;
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
    } else {
        actions.push({
            verb: "restore",
            label: "Restore",
            icon: <ObjectIcons.Restore />,
            onSelect: () => setAction("restore", { history: "push" }),
            disabled: !canUpdate,
        });
    }
    actions.push({
        verb: "delete",
        label: "Delete",
        icon: <ObjectIcons.Delete />,
        onSelect: () => setAction("delete", { history: "push" }),
        disabled: !canDelete,
        destructive: true,
    });

    return (
        <>
            <EntityActionMenu
                actions={actions}
                category="Teams"
                width="w-44"
                after={
                    d4hEnabled && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel>D4H</DropdownMenuLabel>
                            <DropdownMenuGroup>
                                {!linked && (
                                    <DropdownMenuItem
                                        disabled={!canUpdate}
                                        onClick={() =>
                                            void setAction("d4h-link", { history: "push" })
                                        }
                                    >
                                        <D4HIcons.Link /> Link to D4H
                                    </DropdownMenuItem>
                                )}
                                {linked && isActive && (
                                    <DropdownMenuItem
                                        disabled={!canUpdate}
                                        onClick={() =>
                                            void setAction("d4h-sync", { history: "push" })
                                        }
                                    >
                                        <D4HIcons.Sync /> Sync with D4H
                                    </DropdownMenuItem>
                                )}
                                {linked && (
                                    <DropdownMenuItem
                                        disabled={!canUpdate}
                                        className="text-destructive focus:text-destructive"
                                        onClick={() =>
                                            void setAction("d4h-unlink", { history: "push" })
                                        }
                                    >
                                        <D4HIcons.Unlink /> Unlink from D4H
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuGroup>
                        </>
                    )
                }
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

            <AdminModule_AddTeamMembership_Dialog
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
        </>
    );
}
