/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";
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
import { route } from "@/lib/routes";
import { I3Template } from "@/lib/schemas/i3-template";

import { I3Module_DeleteTemplate_Dialog } from "./delete-template";

export function I3Module_Template_Menu({ template }: { template: I3Template }) {
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
                <DropdownMenuContent>
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <Protect
                        orgId={organization.id}
                        permissions={{ i3Template: ["update"] }}
                        fallback={
                            <Empty size="sm">
                                <EmptyHeader>
                                    <EmptyTitle>No Actions Available</EmptyTitle>
                                    <EmptyDescription>
                                        You do not have permission to perform any actions on this
                                        template.
                                    </EmptyDescription>
                                </EmptyHeader>
                            </Empty>
                        }
                    >
                        <DropdownMenuItem asChild>
                            <Link
                                href={route("/main/[slug]/i3/templates/[template_id]/--update", {
                                    slug: organization.slug,
                                    template_id: template.id,
                                })}
                            >
                                <ObjectIcons.Edit /> Edit
                            </Link>
                        </DropdownMenuItem>
                        <Protect orgId={organization.id} permissions={{ i3Template: ["delete"] }}>
                            <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)}>
                                <ObjectIcons.Delete /> Delete
                            </DropdownMenuItem>
                        </Protect>
                    </Protect>
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
