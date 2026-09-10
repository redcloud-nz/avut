/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";

import { D4HIcons, DropdownMenuTriggerIcon, ObjectIcons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    MenuAction,
    useMenuActionHotkeys,
    type MenuActionProps,
} from "@/components/ui/menu-action";

import { useHasPermission } from "@/hooks/use-has-permission";
import { useOrganization } from "@/hooks/use-organization";
import { TeamData } from "@/lib/schemas/team";

import { AdminModule_DeleteTeam_Dialog } from "./delete-team";

interface AdminModule_TeamMenuProps {
    team: TeamData;
}

const ACTIONS = ["delete", "d4h-link", "d4h-sync", "d4h-unlink"] as const;

export function AdminModule_TeamMenu({ team }: AdminModule_TeamMenuProps) {
    const [action, setAction] = useQueryState("action", parseAsStringLiteral(ACTIONS));

    const d4hEnabled = useOrganization().settings.integrations.d4h.enabled;
    const canUpdate = useHasPermission({ team: ["update"] });
    const canDelete = useHasPermission({ team: ["delete"] });
    const linked = team.d4h !== null;

    const actions: MenuActionProps[] = [
        {
            verb: "delete",
            label: "Delete",
            icon: <ObjectIcons.Delete />,
            onSelect: () => setAction("delete", { history: "push" }),
            disabled: !canDelete,
            destructive: true,
        },
    ];

    useMenuActionHotkeys(actions, "Teams");

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
                    {actions.map((a) => (
                        <MenuAction key={a.verb} {...a} />
                    ))}

                    {d4hEnabled && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel>D4H</DropdownMenuLabel>
                            <DropdownMenuGroup>
                                <DropdownMenuItem
                                    disabled={!canUpdate || linked}
                                    onClick={() => void setAction("d4h-link", { history: "push" })}
                                >
                                    <D4HIcons.Link /> Link to D4H
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    disabled={!canUpdate || !linked}
                                    onClick={() => void setAction("d4h-sync", { history: "push" })}
                                >
                                    <D4HIcons.Sync /> Sync with D4H
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    disabled={!canUpdate || !linked}
                                    className="text-destructive focus:text-destructive"
                                    onClick={() =>
                                        void setAction("d4h-unlink", { history: "push" })
                                    }
                                >
                                    <D4HIcons.Unlink /> Unlink from D4H
                                </DropdownMenuItem>
                            </DropdownMenuGroup>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            <AdminModule_DeleteTeam_Dialog
                team={team}
                open={action === "delete"}
                onOpenChange={(open) =>
                    void setAction(open ? "delete" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />
        </>
    );
}
