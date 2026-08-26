/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { CableIcon } from "lucide-react";
import Link from "next/link";

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

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { TeamData } from "@/lib/schemas/team";

interface AdminModule_TeamMenuProps {
    team: TeamData;
}

export function AdminModule_TeamMenu({ team }: AdminModule_TeamMenuProps) {
    const organization = useOrganization();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                    <DropdownMenuTriggerIcon />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-40" align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <Protect
                    permissions={{ team: ["update"] }}
                    render={(allowed) => (
                        <DropdownMenuItem disabled={!allowed}>
                            <CableIcon /> Link to D4H
                        </DropdownMenuItem>
                    )}
                />
                <Protect
                    permissions={{ team: ["delete"] }}
                    render={(allowed) => (
                        <DropdownMenuItem asChild disabled={!allowed} className="text-destructive">
                            <Link
                                href={route("/orgs/[slug]/admin/teams/[team_id]/--delete", {
                                    slug: organization.slug,
                                    team_id: team.id,
                                })}
                            >
                                <ObjectIcons.Delete /> Delete
                            </Link>
                        </DropdownMenuItem>
                    )}
                />
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
