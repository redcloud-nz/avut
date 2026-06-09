/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { CableIcon } from "lucide-react";
import { useState } from "react";

import { DropdownMenuTriggerIcon, ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

import { useOrganization } from "@/hooks/use-organization";
import { TeamData } from "@/lib/schemas/team";

import { AdminModule_DeleteTeam_Dialog } from "./delete-team";

interface AdminModule_TeamMenuProps {
    team: TeamData;
}

export function AdminModule_TeamMenu({ team }: AdminModule_TeamMenuProps) {
    const organization = useOrganization();

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <DropdownMenuTriggerIcon />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-40" align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <Protect
                        orgId={organization.id}
                        permissions={{ team: ["update"] }}
                        render={(allowed) => (
                            <DropdownMenuItem disabled={!allowed}>
                                <CableIcon /> Link to D4H
                            </DropdownMenuItem>
                        )}
                    />
                    <Protect
                        orgId={organization.id}
                        permissions={{ team: ["delete"] }}
                        render={(allowed) => (
                            <DropdownMenuItem
                                onSelect={() => setDeleteDialogOpen(true)}
                                disabled={!allowed}
                                className="text-destructive"
                            >
                                <ObjectIcons.Delete /> Delete
                            </DropdownMenuItem>
                        )}
                    />
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Delete Team dialog*/}
            <AdminModule_DeleteTeam_Dialog
                team={team}
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
            />
        </>
    );
}
