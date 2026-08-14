/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

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

import { SkillCheckSession } from "@/lib/schemas/skill-check-session";

import { SkillsModule_DeleteSession_Dialog } from "./delete-session";

export function SkillsModule_SessionMenu({ session }: { session: SkillCheckSession }) {
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
                        permissions={{ skillCheckSession: ["delete"] }}
                        fallback={
                            <Empty size="sm">
                                <EmptyHeader>
                                    <EmptyTitle>No Actions Available</EmptyTitle>
                                    <EmptyDescription>
                                        You don&apos;t have permission to delete this session.
                                    </EmptyDescription>
                                </EmptyHeader>
                            </Empty>
                        }
                    >
                        <DropdownMenuItem
                            className="text-destructive"
                            onSelect={() => setDeleteDialogOpen(true)}
                        >
                            <ObjectIcons.Delete /> Delete
                        </DropdownMenuItem>
                    </Protect>
                </DropdownMenuContent>
            </DropdownMenu>

            <SkillsModule_DeleteSession_Dialog
                session={session}
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
            />
        </>
    );
}
