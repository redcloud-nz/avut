/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";
import { useMemo } from "react";
import { toast } from "sonner";

import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import {
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";

import { i3Effects } from "@/client/i3-effects";
import { personnelEffects } from "@/client/personnel-effects";
import { skillPackageBuilderEffects } from "@/client/skill-package-builder-effects";
import { teamsEffects } from "@/client/teams-effects";
import { Kaga } from "@/components/blocks/kaga";
import { Saratoga } from "@/components/blocks/saratoga";
import { MutationButton } from "@/components/ui/button";
import { useHasPermission } from "@/hooks/use-has-permission";
import { useOrganization } from "@/hooks/use-organization";
import { usePreferences } from "@/hooks/use-preferences";
import {
    TrashableEntities,
    trashableEntityList,
    type TrashableEntityId,
} from "@/lib/trash-registry";
import { trpc } from "@/trpc/client";

type TrashRow = {
    id: string;
    type:
        | "Person"
        | "Team"
        | "TeamMembership"
        | "I3Template"
        | "SkillPackage"
        | "SkillGroup"
        | "Skill";
    name: string;
    deletedAt: string | null;
    /** Only set for `TeamMembership` rows — its detail page needs both ids. */
    teamId?: string;
    personId?: string;
    /** Only set for `SkillGroup`/`Skill` rows — their detail pages need the parent package id too. */
    skillPackageId?: string;
};

/** Maps a `listTrash` row's `type` to its `TrashableEntities` registry key, derived from the
 * registry itself rather than duplicating the type→id mapping by hand. */
const entityIdByType = Object.fromEntries(
    trashableEntityList.map((entity) => [entity.objectType, entity.id]),
) as Record<TrashRow["type"], TrashableEntityId>;

function RestoreCell({ row }: { row: TrashRow }) {
    const organization = useOrganization();
    const canRestorePerson = useHasPermission({ person: ["delete"] });
    const canRestoreTeam = useHasPermission({ team: ["delete"] });
    const canRestoreI3Template = useHasPermission({ i3Template: ["delete"] });
    const canRestoreSkillPackageBuilder = useHasPermission({ skillPackageBuilder: ["delete"] });

    const restorePerson = useMutation(
        trpc.personnel.restorePersonFromTrash.mutationOptions({
            meta: { effects: personnelEffects.restorePersonFromTrash },
            onError(error) {
                toast.error(`Failed to restore person: ${error.message}`);
            },
            onSuccess() {
                toast.success(`Person "${row.name}" restored from rubbish.`);
            },
        }),
    );
    const restoreTeam = useMutation(
        trpc.teams.restoreTeamFromTrash.mutationOptions({
            meta: { effects: teamsEffects.restoreTeamFromTrash },
            onError(error) {
                toast.error(`Failed to restore team: ${error.message}`);
            },
            onSuccess() {
                toast.success(`Team "${row.name}" restored from rubbish.`);
            },
        }),
    );
    const restoreTeamMembership = useMutation(
        trpc.teams.restoreTeamMembershipFromTrash.mutationOptions({
            meta: { effects: teamsEffects.restoreTeamMembershipFromTrash },
            onError(error) {
                toast.error(`Failed to restore team membership: ${error.message}`);
            },
            onSuccess() {
                toast.success(`"${row.name}" restored from rubbish.`);
            },
        }),
    );
    const restoreI3Template = useMutation(
        trpc.i3.restoreTemplateFromTrash.mutationOptions({
            meta: { effects: i3Effects.restoreTemplateFromTrash },
            onError(error) {
                toast.error(`Failed to restore template: ${error.message}`);
            },
            onSuccess() {
                toast.success(`Template "${row.name}" restored from rubbish.`);
            },
        }),
    );
    const restorePackage = useMutation(
        trpc.skillPackageBuilder.restorePackageFromTrash.mutationOptions({
            meta: { effects: skillPackageBuilderEffects.restorePackageFromTrash },
            onError(error) {
                toast.error(`Failed to restore skill package: ${error.message}`);
            },
            onSuccess() {
                toast.success(`Skill package "${row.name}" restored from rubbish.`);
            },
        }),
    );
    const restoreGroup = useMutation(
        trpc.skillPackageBuilder.restoreGroupFromTrash.mutationOptions({
            meta: { effects: skillPackageBuilderEffects.restoreGroupFromTrash },
            onError(error) {
                toast.error(`Failed to restore skill group: ${error.message}`);
            },
            onSuccess() {
                toast.success(`Skill group "${row.name}" restored from rubbish.`);
            },
        }),
    );
    const restoreSkill = useMutation(
        trpc.skillPackageBuilder.restoreSkillFromTrash.mutationOptions({
            meta: { effects: skillPackageBuilderEffects.restoreSkillFromTrash },
            onError(error) {
                toast.error(`Failed to restore skill: ${error.message}`);
            },
            onSuccess() {
                toast.success(`Skill "${row.name}" restored from rubbish.`);
            },
        }),
    );

    if (row.type === "Person") {
        return (
            <MutationButton
                type="button"
                variant="outline"
                size="sm"
                disabled={!canRestorePerson}
                status={restorePerson.status}
                text={{ idle: "Restore", pending: "Restoring", success: "Restored" }}
                onClick={() =>
                    restorePerson.mutate({ organizationId: organization.id, personId: row.id })
                }
            />
        );
    }

    if (row.type === "Team") {
        return (
            <MutationButton
                type="button"
                variant="outline"
                size="sm"
                disabled={!canRestoreTeam}
                status={restoreTeam.status}
                text={{ idle: "Restore", pending: "Restoring", success: "Restored" }}
                onClick={() =>
                    restoreTeam.mutate({ organizationId: organization.id, teamId: row.id })
                }
            />
        );
    }

    if (row.type === "TeamMembership" && row.teamId !== undefined && row.personId !== undefined) {
        const { teamId, personId } = row;
        return (
            <MutationButton
                type="button"
                variant="outline"
                size="sm"
                disabled={!canRestoreTeam}
                status={restoreTeamMembership.status}
                text={{ idle: "Restore", pending: "Restoring", success: "Restored" }}
                onClick={() =>
                    restoreTeamMembership.mutate({
                        organizationId: organization.id,
                        teamId,
                        personId,
                    })
                }
            />
        );
    }

    if (row.type === "I3Template") {
        return (
            <MutationButton
                type="button"
                variant="outline"
                size="sm"
                disabled={!canRestoreI3Template}
                status={restoreI3Template.status}
                text={{ idle: "Restore", pending: "Restoring", success: "Restored" }}
                onClick={() =>
                    restoreI3Template.mutate({
                        organizationId: organization.id,
                        templateId: row.id,
                    })
                }
            />
        );
    }

    if (row.type === "SkillPackage") {
        return (
            <MutationButton
                type="button"
                variant="outline"
                size="sm"
                disabled={!canRestoreSkillPackageBuilder}
                status={restorePackage.status}
                text={{ idle: "Restore", pending: "Restoring", success: "Restored" }}
                onClick={() =>
                    restorePackage.mutate({
                        organizationId: organization.id,
                        skillPackageId: row.id,
                    })
                }
            />
        );
    }

    if (row.type === "SkillGroup") {
        return (
            <MutationButton
                type="button"
                variant="outline"
                size="sm"
                disabled={!canRestoreSkillPackageBuilder}
                status={restoreGroup.status}
                text={{ idle: "Restore", pending: "Restoring", success: "Restored" }}
                onClick={() =>
                    restoreGroup.mutate({ organizationId: organization.id, skillGroupId: row.id })
                }
            />
        );
    }

    return (
        <MutationButton
            type="button"
            variant="outline"
            size="sm"
            disabled={!canRestoreSkillPackageBuilder}
            status={restoreSkill.status}
            text={{ idle: "Restore", pending: "Restoring", success: "Restored" }}
            onClick={() =>
                restoreSkill.mutate({ organizationId: organization.id, skillId: row.id })
            }
        />
    );
}

export function AdminModule_Trash_List() {
    const organization = useOrganization();
    const { formatRelativeDateTime } = usePreferences();

    const { data: rows } = useSuspenseQuery(
        trpc.trash.listTrash.queryOptions({ organizationId: organization.id }),
    );

    const columns = useMemo(
        () =>
            Kaga.defineColumns<TrashRow>((columnHelper) => [
                columnHelper.accessor("type", {
                    header: "Type",
                    cell: (ctx) =>
                        TrashableEntities[entityIdByType[ctx.getValue() as TrashRow["type"]]].label,
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: true,
                    enableHiding: false,
                }),
                columnHelper.accessor("name", {
                    header: "Name",
                    cell: (ctx) => {
                        const row = ctx.row.original;
                        const entity = TrashableEntities[entityIdByType[row.type]];
                        return entity.href ? (
                            <Link href={entity.href(organization.slug, row.id)}>{row.name}</Link>
                        ) : (
                            row.name
                        );
                    },
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                    enableHiding: false,
                }),
                columnHelper.accessor("deletedAt", {
                    header: "Deleted",
                    cell: (ctx) => {
                        const value = ctx.getValue();
                        return value ? (
                            formatRelativeDateTime(value)
                        ) : (
                            <span className="text-muted-foreground">&mdash;</span>
                        );
                    },
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                    enableHiding: false,
                }),
                columnHelper.display({
                    id: "restore",
                    header: "",
                    cell: (ctx) => <RestoreCell row={ctx.row.original} />,
                    enableHiding: false,
                }),
            ]),
        [organization.slug, formatRelativeDateTime],
    );

    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions
    const table = useReactTable({
        columns,
        data: rows,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: {
            columnFilters: [],
            pagination: { pageIndex: 0, pageSize: Kaga.DEFAULT_PAGE_SIZE },
            sorting: [{ id: "deletedAt", desc: true }],
        },
    });

    return (
        <Saratoga.Root>
            <Saratoga.Header>
                <Saratoga.Title>Rubbish</Saratoga.Title>
                <Saratoga.Actions></Saratoga.Actions>
            </Saratoga.Header>
            <div>
                <Kaga.TableToolbar table={table} />
                <Kaga.Table table={table} />
                <Kaga.TablePagination table={table} />
            </div>
        </Saratoga.Root>
    );
}
