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

import { I3Template } from "@/lib/schemas/i3-template";

import { I3Module_DeleteTemplate_Dialog } from "./delete-template";

export function I3Module_Template_Menu({ template }: { template: I3Template }) {
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <DropdownMenuTriggerIcon />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <Protect
                        permissions={{ i3Template: ["delete"] }}
                        render={(allowed) => (
                            <DropdownMenuItem
                                onClick={() => setDeleteDialogOpen(true)}
                                disabled={!allowed}
                            >
                                <ObjectIcons.Delete /> Delete
                            </DropdownMenuItem>
                        )}
                    />
                </DropdownMenuContent>
            </DropdownMenu>

            <I3Module_DeleteTemplate_Dialog
                template={template}
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
            />
        </>
    );
}
