/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ComponentProps, useState } from "react";
import { toast } from "sonner";

import { useMutation, useSuspenseQueries } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Button, MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHeadCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { PersonRef } from "@/lib/schemas/person";
import { TeamData, TeamId } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

import { AdminModule_AddTeamMember_Dialog } from "./add-team-member";
import { AdminModule_RemoveTeamMember_Dialog } from "./remove-team-member";

export function AdminModule_Team_Personnel_Content({ teamId }: { teamId: TeamId }) {
    const organization = useOrganization();

    const [{ data: team }, { data: teamMembers }] = useSuspenseQueries({
        queries: [
            trpc.teams.getTeam.queryOptions({ organizationId: organization.id, teamId }),
            trpc.teams.listTeamMemberships.queryOptions({
                organizationId: organization.id,
                teamId,
            }),
        ],
    });

    const [deleteTarget, setDeleteTarget] = useState<PersonRef | null>(null);

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    {
                        label: "Admin",
                        href: route("/orgs/[slug]/admin", { slug: organization.slug }),
                    },
                    {
                        label: "Teams",
                        href: route("/orgs/[slug]/admin/teams", { slug: organization.slug }),
                    },
                    {
                        label: team.name,
                        href: route("/orgs/[slug]/admin/teams/[team_id]", {
                            slug: organization.slug,
                            team_id: teamId,
                        }),
                    },
                    "Personnel",
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Members of {team.name}</Saratoga.Title>
                        <Saratoga.Actions>
                            <Protect permissions={{ team: ["update"] }}>
                                <AdminModule_AddTeamMember_Dialog team={team} />
                            </Protect>
                        </Saratoga.Actions>
                    </Saratoga.Header>
                    <div>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHeadCell>Name</TableHeadCell>
                                    <TableCell className="w-9"></TableCell>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {teamMembers
                                    .sort((a, b) => a.person.name.localeCompare(b.person.name))
                                    .map(({ person, ...teamMembership }) => (
                                        <TableRow key={teamMembership.personId}>
                                            <TableCell>{person.name}</TableCell>
                                            <TableCell className="w-9 p-0">
                                                <Protect permissions={{ team: ["update"] }}>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setDeleteTarget(person)}
                                                    >
                                                        <ObjectIcons.Delete />
                                                    </Button>
                                                </Protect>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                            </TableBody>
                        </Table>

                        <AdminModule_RemoveTeamMember_Dialog
                            organizationId={organization.id}
                            team={team}
                            person={deleteTarget}
                            open={deleteTarget !== null}
                            onOpenChange={() => setDeleteTarget(null)}
                        />
                    </div>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function SyncD4HTeamDialog({ team, ...props }: ComponentProps<typeof Dialog> & { team: TeamData }) {
    const syncMutation = useMutation(
        trpc.teams.syncronizeD4HTeam.mutationOptions({
            onError(error) {
                console.error("Failed to synchronize with D4H:", error);
                toast.error(`Failed to synchronize with D4H: ${error.message}`);
            },
            onSuccess() {
                toast.success("Team synchronized with D4H");

                handleOpenChange(false);
            },
            onSettled(result, error, variables, _onMutateResult, context) {
                // Invalidate team memberships to reflect any changes from the sync
                context.client.invalidateQueries(
                    trpc.teams.listTeamMemberships.queryFilter({
                        organizationId: team.organizationId,
                        teamId: team.id,
                    }),
                );
            },
        }),
    );

    function handleOpenChange(open: boolean) {
        if (!open) {
            syncMutation.reset();
        }
        props.onOpenChange?.(open);
    }

    return (
        <Dialog {...props} onOpenChange={handleOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Synchronize with D4H</DialogTitle>
                    <DialogDescription>
                        This will synchronize the team with its linked D4H team, adding and removing
                        personnel as needed to match the D4H team composition. Are you sure you want
                        to proceed?
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="button"
                        status={syncMutation.status}
                        text={{
                            idle: "Synchronize",
                            pending: "Synchronizing",
                            success: "Synchronized",
                        }}
                        onClick={() =>
                            syncMutation.mutate({
                                teamId: team.id,
                                organizationId: team.organizationId,
                            })
                        }
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
