/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";
import { ReactNode, useMemo } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";
import {
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";

import { Kaga } from "@/components/blocks/kaga";
import { Saratoga } from "@/components/blocks/saratoga";
import { Badge } from "@/components/ui/badge";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { SkillPackage } from "@/lib/schemas/skill-package";
import { trpc, type RouterOutput } from "@/trpc/client";

type PackageRow = RouterOutput["skillPackageSubscriptions"]["listPackages"][number];

/**
 * The packages this organisation subscribes to, then the published ones it doesn't. Only the
 * second list is searchable: an organisation subscribes to a handful of packages at most.
 */
export function SkillTrack_Packages_List() {
    const organization = useOrganization();

    const { data: packages } = useSuspenseQuery(
        trpc.skillPackageSubscriptions.listPackages.queryOptions({
            organizationId: organization.id,
        }),
    );

    // `listPackages` only returns a withdrawn package to a subscriber, so every withdrawn row
    // lands in Subscribed.
    const subscribed = useMemo(() => packages.filter((pkg) => pkg.subscription), [packages]);
    const available = useMemo(() => packages.filter((pkg) => !pkg.subscription), [packages]);

    return (
        <Saratoga.Root>
            <Saratoga.Header>
                <Saratoga.Title>Packages</Saratoga.Title>
            </Saratoga.Header>
            <PackagesSection title="Subscribed">
                {subscribed.length === 0 ? (
                    <EmptyMessage>Not subscribed to any packages yet.</EmptyMessage>
                ) : (
                    <PackagesTable packages={subscribed} subscribed />
                )}
            </PackagesSection>
            <PackagesSection title="Available">
                {available.length === 0 ? (
                    <EmptyMessage>
                        {!subscribed.some((pkg) => SkillPackage.isAvailable(pkg))
                            ? "No packages are published yet."
                            : "Subscribed to every published package."}
                    </EmptyMessage>
                ) : (
                    <PackagesTable packages={available} subscribed={false} />
                )}
            </PackagesSection>
        </Saratoga.Root>
    );
}

function PackagesSection({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="space-y-2 not-first-of-type:pt-6">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            {children}
        </section>
    );
}

function EmptyMessage({ children }: { children: ReactNode }) {
    return <p className="text-muted-foreground text-sm">{children}</p>;
}

/** Subscribed packages can get a Status column for the Withdrawn badge; available ones get search. */
function PackagesTable({ packages, subscribed }: { packages: PackageRow[]; subscribed: boolean }) {
    const organization = useOrganization();

    // The Status column only carries the Withdrawn badge, so leave it out when nothing has one.
    const showStatus = subscribed && packages.some((pkg) => !SkillPackage.isAvailable(pkg));

    const columns = useMemo(
        () =>
            Kaga.defineColumns<PackageRow>((columnHelper) => [
                columnHelper.accessor("name", {
                    header: "Package Name",
                    cell: (ctx) => (
                        <Link
                            href={route("/orgs/[slug]/skill-track/packages/[package_id]", {
                                slug: organization.slug,
                                package_id: ctx.row.original.id,
                            })}
                        >
                            {ctx.getValue()}
                        </Link>
                    ),
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("organization.name", {
                    header: "Publisher",
                    cell: (ctx) => ctx.getValue(),
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("skillCount", {
                    header: "Skills",
                    cell: (ctx) => ctx.getValue() + "",
                    enableSorting: false,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                }),
                // How popular a package is only matters when choosing one to subscribe to.
                subscribed
                    ? null
                    : columnHelper.accessor("subscriptionCount", {
                          header: "Subscriptions",
                          cell: (ctx) => ctx.getValue() + "",
                          enableSorting: true,
                          enableGlobalFilter: false,
                          enableColumnFilter: false,
                      }),
                showStatus
                    ? columnHelper.display({
                          id: "status",
                          header: "Status",
                          cell: (ctx) =>
                              SkillPackage.isAvailable(ctx.row.original) ? null : (
                                  <Badge variant="outline">Withdrawn</Badge>
                              ),
                          enableSorting: false,
                          enableGlobalFilter: false,
                          enableColumnFilter: false,
                      })
                    : null,
            ]),
        [organization.slug, subscribed, showStatus],
    );

    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions
    const table = useReactTable({
        data: packages,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        globalFilterFn: "includesString",
        initialState: {
            sorting: [{ id: "name", desc: false }],
        },
    });

    return (
        <div>
            {!subscribed && <Kaga.TableToolbar table={table} />}
            <Kaga.Table table={table} />
        </div>
    );
}
