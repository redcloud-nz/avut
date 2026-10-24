/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { CornerDownRightIcon, ExternalLinkIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense, useMemo, type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query";
import {
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";

import { Kaga } from "@/components/blocks/kaga";
import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { D4HItemRef } from "@/components/d4h/d4h-item-ref";
import { D4HEquipmentBrandLink } from "@/components/entity-links/d4h-equipment-brand-link";
import { D4HEquipmentCategoryLink } from "@/components/entity-links/d4h-equipment-category-link";
import { D4HEquipmentItemLink } from "@/components/entity-links/d4h-equipment-item-link";
import { D4HEquipmentModelLink } from "@/components/entity-links/d4h-equipment-model-link";
import { D4HEquipmentTypeLink } from "@/components/entity-links/d4h-equipment-type-link";
import { D4HMemberLink } from "@/components/entity-links/d4h-member-link";
import { D4HTeamLink } from "@/components/entity-links/d4h-team-link";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardAction,
    CardContent,
    CardHeader,
    CardLoadingFallback,
    CardTitle,
} from "@/components/ui/card";
import { DataItem, DataItemTitle, DataItemValue, DataList } from "@/components/ui/data-item";
import { useOrganization } from "@/hooks/use-organization";
import { usePreferences } from "@/hooks/use-preferences";
import { hasD4HTeamPermission } from "@/lib/d4h-permissions";
import { route } from "@/lib/routes";
import { D4HEquipmentListItem, D4HEquipmentStatus } from "@/lib/schemas/d4h/equipment-item";
import { trpc } from "@/trpc/client";

import { D4HModule_ItemTasks_Card } from "../tasks/item-tasks-card";

import { D4HModule_EquipmentItem_Menu } from "./equipment-item-menu";
import {
    D4HModule_UpdateEquipmentItem_Dialog,
    updateEquipmentItemDisabledReason,
} from "./update-equipment-item";

/**
 * A D4H equipment item, read live from D4H with the viewer's token.
 *
 * Other modules add to the page through slots that `page.tsx` fills: `menuActions` and
 * `menuDialogs` go to the Actions menu (see `EntityActionMenu`), and `statusBadge` sits beside the
 * D4H Status value.
 */
export function D4HModule_EquipmentItem_Content({
    teamId,
    itemId,
    menuActions,
    menuDialogs,
    statusBadge,
}: {
    teamId: number;
    itemId: number;
    menuActions?: ReactNode;
    menuDialogs?: ReactNode;
    statusBadge?: ReactNode;
}) {
    const organization = useOrganization();
    const slug = organization.slug;
    const { formatDate } = usePreferences();

    const [
        {
            data: { item, d4hUrl, holder },
        },
        { data: teams },
        { data: categories },
    ] = useSuspenseQueries({
        queries: [
            trpc.d4hApi.getEquipmentItem.queryOptions({
                organizationId: organization.id,
                teamId,
                itemId,
            }),
            trpc.d4hApi.listAccessibleTeams.queryOptions({ organizationId: organization.id }),
            // The single-item GET doesn't reliably expand the kind's category, so the name
            // comes from the category list (the member page does the same).
            trpc.d4hApi.listEquipmentCategories.queryOptions({ organizationId: organization.id }),
        ],
    });

    const team = teams.find((t) => t.id === teamId);
    if (!team) notFound();

    const category = categories.find((c) => c.id === item.category.id);

    const canUpdateInD4H = hasD4HTeamPermission(team.permissions, "Equipment", "UPDATE");
    const canRetireInD4H = hasD4HTeamPermission(team.permissions, "Equipment", "RETIRE");

    const dates = [
        { label: "Purchased", value: item.datePurchased },
        { label: "Manufactured", value: item.dateManufactured },
        { label: "First Use", value: item.dateFirstUse },
        { label: "Warranty", value: item.dateWarranty },
        { label: "Expires", value: item.dateExpires },
        { label: "Retired", value: item.dateRetired },
    ].filter((date): date is { label: string; value: string } => date.value !== null);

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    { label: "D4H", href: route("/orgs/[slug]/d4h", { slug }) },
                    { label: "Teams", href: route("/orgs/[slug]/d4h/teams", { slug }) },
                    {
                        label: team.title,
                        href: route("/orgs/[slug]/d4h/teams/[d4h_team_id]", {
                            slug,
                            d4h_team_id: String(teamId),
                        }),
                    },
                    { label: `Item ${item.ref}` },
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>
                            <D4HItemRef value={item.ref} /> {item.kind.title}
                        </Saratoga.Title>
                        <Saratoga.Actions>
                            {/* Icon-only below `sm`, with the label kept for screen readers. */}
                            <Button asChild variant="outline" className="max-sm:w-8 max-sm:px-0">
                                <a href={d4hUrl} target="_blank" rel="noreferrer">
                                    <ExternalLinkIcon />
                                    <span className="sr-only sm:not-sr-only">Open in D4H</span>
                                </a>
                            </Button>
                            <D4HModule_EquipmentItem_Menu
                                canUpdateInD4H={canUpdateInD4H}
                                extraActions={menuActions}
                                dialogs={menuDialogs}
                            />
                        </Saratoga.Actions>
                    </Saratoga.Header>

                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Item Information</CardTitle>
                                    <CardAction>
                                        <Protect
                                            permissions={{ d4hEquipment: ["update"] }}
                                            render={(hasPermission) => (
                                                <D4HModule_UpdateEquipmentItem_Dialog
                                                    teamId={teamId}
                                                    item={item}
                                                    disabledReason={updateEquipmentItemDisabledReason(
                                                        {
                                                            hasPermission,
                                                            canUpdateInD4H,
                                                            teamTitle: team.title,
                                                        },
                                                    )}
                                                />
                                            )}
                                        />
                                    </CardAction>
                                </CardHeader>
                                <CardContent>
                                    <DataList>
                                        <DataItem inline>
                                            <DataItemTitle>Ref</DataItemTitle>
                                            <DataItemValue>
                                                <D4HItemRef value={item.ref} />
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Team</DataItemTitle>
                                            <DataItemValue>
                                                <D4HTeamLink team={team} />
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Type</DataItemTitle>
                                            <DataItemValue>
                                                <D4HEquipmentTypeLink type={item.kind} />
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Category</DataItemTitle>
                                            <DataItemValue>
                                                {category ? (
                                                    <D4HEquipmentCategoryLink category={category} />
                                                ) : (
                                                    "—"
                                                )}
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Brand</DataItemTitle>
                                            <DataItemValue>
                                                {item.brand.id != null && item.brand.title ? (
                                                    <D4HEquipmentBrandLink
                                                        brand={{
                                                            id: item.brand.id,
                                                            title: item.brand.title,
                                                        }}
                                                    />
                                                ) : (
                                                    item.brand.title || "—"
                                                )}
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Model</DataItemTitle>
                                            <DataItemValue>
                                                {item.model?.id != null &&
                                                item.model.title &&
                                                item.brand.id != null ? (
                                                    <D4HEquipmentModelLink
                                                        model={{
                                                            id: item.model.id,
                                                            title: item.model.title,
                                                            brand: { id: item.brand.id },
                                                        }}
                                                    />
                                                ) : (
                                                    item.model?.title || "—"
                                                )}
                                            </DataItemValue>
                                        </DataItem>
                                        {item.parents.length > 0 && (
                                            <DataItem>
                                                <DataItemTitle>Parents</DataItemTitle>
                                                <DataItemValue>
                                                    <ParentsTree
                                                        parents={item.parents}
                                                        teamId={teamId}
                                                    />
                                                </DataItemValue>
                                            </DataItem>
                                        )}
                                        <DataItem inline>
                                            <DataItemTitle>Serial Number</DataItemTitle>
                                            <DataItemValue>{item.serial}</DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>D4H Status</DataItemTitle>
                                            <DataItemValue className="flex flex-wrap items-center gap-2">
                                                {D4HEquipmentStatus.label(item.status)}
                                                {statusBadge}
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Issued To</DataItemTitle>
                                            <DataItemValue>
                                                {holder ? (
                                                    // The name comes from this team's member list,
                                                    // so the member page is under this team.
                                                    <D4HMemberLink
                                                        member={{
                                                            ...holder,
                                                            owner: { id: teamId },
                                                        }}
                                                    />
                                                ) : (
                                                    // Not held by a member: Parents already says
                                                    // which container it's in.
                                                    "—"
                                                )}
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Critical</DataItemTitle>
                                            <DataItemValue>
                                                {item.isCritical ? "Yes" : "No"}
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Monitor</DataItemTitle>
                                            <DataItemValue>
                                                {item.isMonitor ? "Yes" : "No"}
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Barcode</DataItemTitle>
                                            <DataItemValue>{item.barcode}</DataItemValue>
                                        </DataItem>
                                        {dates.map(({ label, value }) => (
                                            <DataItem key={label} inline>
                                                <DataItemTitle>{label}</DataItemTitle>
                                                <DataItemValue>{formatDate(value)}</DataItemValue>
                                            </DataItem>
                                        ))}
                                        <DataItem>
                                            <DataItemTitle>Notes</DataItemTitle>
                                            <DataItemValue className="whitespace-pre-line">
                                                {item.notes}
                                            </DataItemValue>
                                        </DataItem>
                                    </DataList>
                                </CardContent>
                            </Card>
                            <ItemContentsBoundary>
                                <ItemContents teamId={teamId} itemId={itemId} />
                            </ItemContentsBoundary>
                        </Saratoga.Column>
                        <Saratoga.Column slot="secondary">
                            <Protect permissions={{ d4hTask: ["view"] }}>
                                <Suspense fallback={<CardLoadingFallback />}>
                                    <D4HModule_ItemTasks_Card
                                        teamId={teamId}
                                        itemId={itemId}
                                        itemLabel={`#${item.ref} ${item.kind.title}`}
                                        canRetireInD4H={canRetireInD4H}
                                    />
                                </Suspense>
                            </Protect>
                        </Saratoga.Column>
                    </Saratoga.Columns>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}

/**
 * The containers this item is stored in, outermost first, each indented under the one before and
 * linked to its item page.
 */
function ParentsTree({
    parents,
    teamId,
}: {
    parents: { id: number; ref: string }[];
    teamId: number;
}) {
    return (
        <ul className="flex flex-col gap-1">
            {parents.map((parent, index) => (
                <li
                    key={parent.id}
                    className="flex items-center gap-1"
                    style={{ paddingLeft: `${index * 1.5}rem` }}
                >
                    {index > 0 && (
                        <CornerDownRightIcon className="size-4 text-muted-foreground" aria-hidden />
                    )}
                    {/* A parent carries no owner, so it's taken to be in this item's team. */}
                    <D4HEquipmentItemLink item={{ ...parent, owner: { id: teamId } }} />
                </li>
            ))}
        </ul>
    );
}

/**
 * Keeps a failed contents fetch to one line, so it doesn't take the whole item page to the route's
 * error boundary.
 */
function ItemContentsBoundary({ children }: { children: ReactNode }) {
    return (
        <ErrorBoundary
            fallback={
                <p className="mt-4 text-sm text-muted-foreground">Couldn&apos;t load contents.</p>
            }
        >
            <Suspense fallback={null}>{children}</Suspense>
        </ErrorBoundary>
    );
}

/** The current items stored in this one, as a table. Renders nothing when there are none. */
function ItemContents({ teamId, itemId }: { teamId: number; itemId: number }) {
    const organization = useOrganization();

    const { data: contents } = useSuspenseQuery(
        trpc.d4hApi.listEquipmentItemContents.queryOptions({
            organizationId: organization.id,
            teamId,
            itemId,
        }),
    );

    const { data: teams } = useSuspenseQuery(
        trpc.d4hApi.listAccessibleTeams.queryOptions({ organizationId: organization.id }),
    );

    const columns = useMemo(
        () =>
            Kaga.defineColumns<D4HEquipmentListItem>((columnHelper) => [
                columnHelper.accessor("ref", {
                    header: "Ref",
                    // A contained item can belong to another team. Its page lives under that team,
                    // so link there, and not at all when that team is out of reach.
                    cell: (ctx) => {
                        const item = ctx.row.original;
                        if (!teams.some((t) => t.id === item.owner.id))
                            return <D4HItemRef value={item.ref} />;
                        return <D4HEquipmentItemLink item={item} />;
                    },
                    enableGlobalFilter: true,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("kind.title", {
                    header: "Type",
                    cell: (ctx) => <D4HEquipmentTypeLink type={ctx.row.original.kind} />,
                    enableGlobalFilter: true,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor((row) => row.brand.title ?? "", {
                    id: "brand",
                    header: "Brand",
                    cell: (ctx) => {
                        const { brand } = ctx.row.original;
                        if (brand.id == null || !brand.title) return ctx.getValue() || "—";
                        return (
                            <D4HEquipmentBrandLink brand={{ id: brand.id, title: brand.title }} />
                        );
                    },
                    enableGlobalFilter: true,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor((row) => row.model?.title ?? "", {
                    id: "model",
                    header: "Model",
                    cell: (ctx) => {
                        const { brand, model } = ctx.row.original;
                        if (model?.id == null || !model.title || brand.id == null) {
                            return ctx.getValue() || "—";
                        }
                        return (
                            <D4HEquipmentModelLink
                                model={{
                                    id: model.id,
                                    title: model.title,
                                    brand: { id: brand.id },
                                }}
                            />
                        );
                    },
                    enableGlobalFilter: true,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("status", {
                    header: "D4H Status",
                    cell: (ctx) => D4HEquipmentStatus.label(ctx.getValue()),
                    filterFn: Kaga.filterFns.oneOf,
                    enableColumnFilter: true,
                    enableSorting: false,
                    enableGlobalFilter: false,
                    meta: {
                        // `listEquipmentItemContents` asks for current items only, so no wishlist.
                        columnOptions: D4HEquipmentStatus.schema.options
                            .filter((value) => value !== "WISHLIST")
                            .map((value) => ({ value, label: D4HEquipmentStatus.label(value) })),
                    },
                }),
            ]),
        [teams],
    );

    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions
    const table = useReactTable({
        data: contents,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        initialState: {
            pagination: { pageIndex: 0, pageSize: Kaga.DEFAULT_PAGE_SIZE },
            sorting: [{ id: "ref", desc: false }],
        },
    });

    if (contents.length === 0) return null;

    return (
        <div className="mt-4">
            <div className="mb-2 text-lg font-semibold">Contents</div>
            <Kaga.TableToolbar table={table} />
            <Kaga.Table table={table} />
            <Kaga.TablePagination table={table} />
        </div>
    );
}
