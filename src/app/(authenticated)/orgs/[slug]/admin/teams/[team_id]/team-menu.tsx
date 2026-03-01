/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { DropdownMenuTriggerIcon, ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldGroup } from "@/components/ui/field";
import { Link } from "@/components/ui/link";
import { ObjectName } from "@/components/ui/typography";

import { OrganizationClient } from "@/hooks/use-organization";
import { TeamData } from "@/lib/schemas/team";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

interface AdminModule_TeamMenuProps {
    organization: OrganizationClient;
    team: TeamData;
}

export function AdminModule_TeamMenu({
    organization,
    team,
}: AdminModule_TeamMenuProps) {
    const queryClient = useQueryClient();
    const router = useRouter();

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    async function invalidateTeamQueries() {
        await Promise.all([
            queryClient.invalidateQueries(
                trpc.teams.listTeams.queryFilter({
                    organizationId: organization.id,
                }),
            ),
        ]);
    }

    const deleteMutation = useMutation(
        trpc.teams.deleteTeam.mutationOptions({
            async onSuccess() {
                router.push(Paths.org(organization.slug).admin.teams.href);
                invalidateTeamQueries();
            },
        }),
    );

    function handleDelete() {
        setDeleteDialogOpen(false);
        toast.promise(
            async () => {
                await deleteMutation.mutateAsync({
                    organizationId: organization.id,
                    teamId: team.id,
                });
            },
            {
                loading: "Deleting team...",
                success: "Team deleted.",
                error: (error: any) =>
                    "Failed to delete team: " + error.message,
            },
        );
    }

    return (
        <>
            <Protect orgId={organization.id} permissions={{ team: ["delete"] }}>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="justify-self-end"
                        >
                            <DropdownMenuTriggerIcon />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-40" align="end">
                        {/* <DropdownMenuGroup>
                            <DropdownMenuItem disabled asChild>
                                <Link
                                    to={
                                        Paths.org(organization.slug).admin.team(
                                            team.id,
                                        ).history
                                    }
                                >
                                    <ObjectIcons.History /> History
                                </Link>
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator /> */}
                        <DropdownMenuGroup>
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem
                                onSelect={() => setDeleteDialogOpen(true)}
                                className="text-destructive"
                            >
                                <ObjectIcons.Delete /> Delete
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            </Protect>

            {/* Delete Team dialog*/}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Team</DialogTitle>
                        <DialogDescription>
                            Confirm deletion of team{" "}
                            <ObjectName>{team.name}</ObjectName>.
                        </DialogDescription>
                    </DialogHeader>
                    <FieldGroup>
                        <Field orientation="horizontal">
                            <Button
                                type="button"
                                variant="destructive"
                                disabled={deleteMutation.isPending}
                                onClick={handleDelete}
                            >
                                Delete
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setDeleteDialogOpen(false)}
                            >
                                Cancel
                            </Button>
                        </Field>
                    </FieldGroup>
                </DialogContent>
            </Dialog>
        </>
    );
}
