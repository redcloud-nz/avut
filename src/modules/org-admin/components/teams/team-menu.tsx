/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";

import { ObjectIcons } from "@/components/icons";
import { Teams_AddTeamMembership_Dialog } from "@/components/teams/add-team-membership";
import { type MenuActionProps } from "@/components/ui/menu-action";
import { RecordCardMenu } from "@/components/ui/record-card-actions";
import { useHasPermission } from "@/hooks/use-has-permission";
import { TeamData } from "@/lib/schemas/team";

import { AdminModule_ArchiveTeam_Dialog } from "./archive-team";
import { AdminModule_DeleteTeam_Dialog } from "./delete-team";
import { AdminModule_RecoverTeam_Dialog } from "./recover-team";
import { AdminModule_RestoreTeam_Dialog } from "./restore-team";

interface AdminModule_TeamMenuProps {
    team: TeamData;
}

const ACTIONS = ["update", "delete", "add-membership", "archive", "restore", "recover"] as const;

/**
 * The Team card's ⋮ (the page's primary record card): Archive, Restore or Recover, and Delete.
 * Edit is the card's pencil, History its "Updated" footer, Add person the Related card's Add,
 * and the D4H actions are on the Linked D4H Team card and the D4H action card.
 *
 * Mounts the page's lifecycle and Add person dialogs; `Teams_D4HCard` mounts the D4H ones.
 */
export function AdminModule_Team_Menu({ team }: AdminModule_TeamMenuProps) {
    const [action, setAction] = useQueryState("action", parseAsStringLiteral(ACTIONS));

    const canUpdate = useHasPermission({ team: ["update"] });
    const canDelete = useHasPermission({ team: ["delete"] });

    const actions: MenuActionProps[] = [];
    if (team.status === "Active" && canUpdate) {
        actions.push({
            verb: "archive",
            label: "Archive",
            icon: <ObjectIcons.Archive />,
            onSelect: () => setAction("archive", { history: "push" }),
        });
    }
    if (team.status === "Archived" && canUpdate) {
        actions.push({
            verb: "restore",
            label: "Restore",
            icon: <ObjectIcons.Restore />,
            onSelect: () => setAction("restore", { history: "push" }),
        });
    }
    if (team.status === "Deleted" && canDelete) {
        actions.push({
            verb: "recover",
            label: "Recover from rubbish",
            icon: <ObjectIcons.Recover />,
            onSelect: () => setAction("recover", { history: "push" }),
        });
    }
    if (team.status !== "Deleted" && canDelete) {
        actions.push({
            verb: "delete",
            label: "Delete",
            icon: <ObjectIcons.Delete />,
            onSelect: () => setAction("delete", { history: "push" }),
            destructive: true,
        });
    }

    return (
        <>
            <RecordCardMenu actions={actions} category="Teams" primary />

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
