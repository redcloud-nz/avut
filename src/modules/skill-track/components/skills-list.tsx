/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { PocketKnifeIcon } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";
import {
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";

import { Kaga } from "@/components/blocks/kaga";
import { Saratoga } from "@/components/blocks/saratoga";
import { Show } from "@/components/show";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { Skill } from "@/lib/schemas/skill";
import { SkillGroup } from "@/lib/schemas/skill-group";
import { SkillPackage } from "@/lib/schemas/skill-package";
import { trpc } from "@/trpc/client";

type SkillRow = Skill & { group: SkillGroup | undefined; skillPackage: SkillPackage };

function isArchived(row: SkillRow) {
    return row.status !== "Active" || (row.group !== undefined && row.group.status !== "Active");
}

/**
 * Every skill in the organization's subscribed packages, flat. Reads the same query as the
 * dashboard's Skills stat card, so the two always agree on the count.
 */
export function SkillTrack_SkillsList() {
    const organization = useOrganization();

    const { data: assessable } = useSuspenseQuery(
        trpc.skillPackageSubscriptions.listAssessableSkills.queryOptions({
            organizationId: organization.id,
        }),
    );

    // Join each skill to its group and package, in catalogue order: package, then the author's
    // group and skill order within it.
    const rows = useMemo(() => {
        const packages = new Map(assessable.skillPackages.map((pkg) => [pkg.id, pkg]));
        const groups = new Map(assessable.skillGroups.map((group) => [group.id, group]));

        return assessable.skills
            .flatMap((skill): SkillRow[] => {
                const skillPackage = packages.get(skill.skillPackageId);
                return skillPackage
                    ? [{ ...skill, group: groups.get(skill.skillGroupId), skillPackage }]
                    : [];
            })
            .sort(
                (a, b) =>
                    a.skillPackage.name.localeCompare(b.skillPackage.name) ||
                    a.skillPackageId.localeCompare(b.skillPackageId) ||
                    (a.group?.sequence ?? 0) - (b.group?.sequence ?? 0) ||
                    a.sequence - b.sequence,
            );
    }, [assessable]);

    // Packages from different publishers can share a name; the filter matches on the name, so
    // list each name once.
    const packageOptions = useMemo(
        () =>
            [...new Set(assessable.skillPackages.map((pkg) => pkg.name))]
                .sort((a, b) => a.localeCompare(b))
                .map((name) => ({ label: name, value: name })),
        [assessable.skillPackages],
    );

    const columns = useMemo(
        () =>
            Kaga.defineColumns<SkillRow>((col) => [
                col.accessor("name", {
                    header: "Skill",
                    // The reports and the package's catalogue page leave archived skills out, so
                    // say why a row here is missing from them.
                    cell: (ctx) =>
                        isArchived(ctx.row.original) ? (
                            <span className="flex items-center gap-2">
                                {ctx.getValue()}
                                <Badge variant="outline">Archived</Badge>
                            </span>
                        ) : (
                            ctx.getValue()
                        ),
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                }),
                col.accessor((row) => row.group?.name ?? "", {
                    id: "group",
                    header: "Group",
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                }),
                col.accessor((row) => row.skillPackage.name, {
                    id: "package",
                    header: "Package",
                    cell: (ctx) => (
                        <Link
                            href={route("/orgs/[slug]/skill-track/catalogue/[package_id]", {
                                slug: organization.slug,
                                package_id: ctx.row.original.skillPackageId,
                            })}
                        >
                            {ctx.getValue()}
                        </Link>
                    ),
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: true,
                    filterFn: Kaga.filterFns.oneOf,
                    meta: { columnOptions: packageOptions },
                }),
                col.accessor("frequency", {
                    header: "Frequency",
                    cell: (ctx) => {
                        const months = ctx.getValue();
                        return months > 0
                            ? `${months} ${months === 1 ? "month" : "months"}`
                            : "None";
                    },
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                }),
                col.accessor("tags", {
                    header: "Tags",
                    cell: (ctx) => (
                        <div className="flex flex-wrap gap-1">
                            {ctx.row.original.tags.map((tag) => (
                                <Badge key={tag} variant="secondary">
                                    {tag}
                                </Badge>
                            ))}
                        </div>
                    ),
                    enableSorting: false,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                }),
            ]),
        [organization.slug, packageOptions],
    );

    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions
    const table = useReactTable({
        data: rows,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        globalFilterFn: "includesString",
        initialState: {
            pagination: { pageIndex: 0, pageSize: Kaga.DEFAULT_PAGE_SIZE },
        },
    });

    return (
        <Saratoga.Root>
            <Saratoga.Header>
                <Saratoga.Title>Skills</Saratoga.Title>
            </Saratoga.Header>
            <Show
                when={rows.length > 0}
                fallback={
                    <Empty>
                        <EmptyMedia>
                            <PocketKnifeIcon className="size-12 text-muted-foreground" />
                        </EmptyMedia>
                        <EmptyDescription>
                            No skills yet. Subscribe to a package in the{" "}
                            <Link
                                href={route("/orgs/[slug]/skill-track/catalogue", {
                                    slug: organization.slug,
                                })}
                            >
                                Catalogue
                            </Link>{" "}
                            to add its skills.
                        </EmptyDescription>
                    </Empty>
                }
            >
                <div>
                    <Kaga.TableToolbar table={table} />
                    <Kaga.Table table={table} />
                    <Kaga.TablePagination table={table} />
                </div>
            </Show>
        </Saratoga.Root>
    );
}
