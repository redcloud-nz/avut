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

function RecoverCell({ row }: { row: TrashRow }) {
    const organization = useOrganization();
    const canRecoverPerson = useHasPermission({ person: ["delete"] });
    const canRecoverTeam = useHasPermission({ team: ["delete"] });
    const canRecoverI3Template = useHasPermission({ i3Template: ["delete"] });
    const canRecoverSkillPackageBuilder = useHasPermission({ skillPackageBuilder: ["delete"] });

    const recoverPerson = useMutation(
        trpc.personnel.recoverPerson.mutationOptions({
            meta: { effects: personnelEffects.recoverPerson },
            onError(error) {
                toast.error(`Failed to recover person: ${error.message}`);
            },
            onSuccess() {
                toast.success(`Person "${row.name}" recovered from rubbish.`);
            },
        }),
    );
    const recoverTeam = useMutation(
        trpc.teams.recoverTeam.mutationOptions({
            meta: { effects: teamsEffects.recoverTeam },
            onError(error) {
                toast.error(`Failed to recover team: ${error.message}`);
            },
            onSuccess() {
                toast.success(`Team "${row.name}" recovered from rubbish.`);
            },
        }),
    );
    const recoverTeamMembership = useMutation(
        trpc.teams.recoverTeamMembership.mutationOptions({
            meta: { effects: teamsEffects.recoverTeamMembership },
            onError(error) {
                toast.error(`Failed to recover team membership: ${error.message}`);
            },
            onSuccess() {
                toast.success(`"${row.name}" recovered from rubbish.`);
            },
        }),
    );
    const recoverI3Template = useMutation(
        trpc.i3.recoverTemplate.mutationOptions({
            meta: { effects: i3Effects.recoverTemplate },
            onError(error) {
                toast.error(`Failed to recover template: ${error.message}`);
            },
            onSuccess() {
                toast.success(`Template "${row.name}" recovered from rubbish.`);
            },
        }),
    );
    const recoverPackage = useMutation(
        trpc.skillPackageBuilder.recoverPackage.mutationOptions({
            meta: { effects: skillPackageBuilderEffects.recoverPackage },
            onError(error) {
                toast.error(`Failed to recover skill package: ${error.message}`);
            },
            onSuccess() {
                toast.success(`Skill package "${row.name}" recovered from rubbish.`);
            },
        }),
    );
    const recoverGroup = useMutation(
        trpc.skillPackageBuilder.recoverGroup.mutationOptions({
            meta: { effects: skillPackageBuilderEffects.recoverGroup },
            onError(error) {
                toast.error(`Failed to recover skill group: ${error.message}`);
            },
            onSuccess() {
                toast.success(`Skill group "${row.name}" recovered from rubbish.`);
            },
        }),
    );
    const recoverSkill = useMutation(
        trpc.skillPackageBuilder.recoverSkill.mutationOptions({
            meta: { effects: skillPackageBuilderEffects.recoverSkill },
            onError(error) {
                toast.error(`Failed to recover skill: ${error.message}`);
            },
            onSuccess() {
                toast.success(`Skill "${row.name}" recovered from rubbish.`);
            },
        }),
    );

    if (row.type === "Person") {
        return (
            <MutationButton
                type="button"
                variant="outline"
                size="sm"
                disabled={!canRecoverPerson}
                status={recoverPerson.status}
                text={{ idle: "Recover", pending: "Recovering", success: "Recovered" }}
                onClick={() =>
                    recoverPerson.mutate({ organizationId: organization.id, personId: row.id })
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
                disabled={!canRecoverTeam}
                status={recoverTeam.status}
                text={{ idle: "Recover", pending: "Recovering", success: "Recovered" }}
                onClick={() =>
                    recoverTeam.mutate({ organizationId: organization.id, teamId: row.id })
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
                disabled={!canRecoverTeam}
                status={recoverTeamMembership.status}
                text={{ idle: "Recover", pending: "Recovering", success: "Recovered" }}
                onClick={() =>
                    recoverTeamMembership.mutate({
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
                disabled={!canRecoverI3Template}
                status={recoverI3Template.status}
                text={{ idle: "Recover", pending: "Recovering", success: "Recovered" }}
                onClick={() =>
                    recoverI3Template.mutate({
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
                disabled={!canRecoverSkillPackageBuilder}
                status={recoverPackage.status}
                text={{ idle: "Recover", pending: "Recovering", success: "Recovered" }}
                onClick={() =>
                    recoverPackage.mutate({
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
                disabled={!canRecoverSkillPackageBuilder}
                status={recoverGroup.status}
                text={{ idle: "Recover", pending: "Recovering", success: "Recovered" }}
                onClick={() =>
                    recoverGroup.mutate({ organizationId: organization.id, skillGroupId: row.id })
                }
            />
        );
    }

    return (
        <MutationButton
            type="button"
            variant="outline"
            size="sm"
            disabled={!canRecoverSkillPackageBuilder}
            status={recoverSkill.status}
            text={{ idle: "Recover", pending: "Recovering", success: "Recovered" }}
            onClick={() =>
                recoverSkill.mutate({ organizationId: organization.id, skillId: row.id })
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
                    id: "recover",
                    header: "",
                    cell: (ctx) => <RecoverCell row={ctx.row.original} />,
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
