/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ExternalLinkIcon } from "lucide-react";
import { Suspense, type ReactNode } from "react";

import { useSuspenseQueries } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
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
import { D4HEquipmentStatus } from "@/lib/schemas/d4h/equipment-item";
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
 * Other modules add to the page through slots that `page.tsx` fills: `actions` renders after the
 * Actions menu, and `statusBadge` beside the D4H Status value.
 */
export function D4HModule_EquipmentItem_Content({
    teamId,
    itemId,
    actions,
    statusBadge,
}: {
    teamId: number;
    itemId: number;
    actions?: ReactNode;
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
    if (!team) throw new Error(`D4HTeam(${teamId}) not found`);

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
                    team.title,
                    { label: `Item #${item.ref}` },
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>
                            #{item.ref} {item.kind.title}
                        </Saratoga.Title>
                        <Saratoga.Actions>
                            <Button asChild variant="outline" size="sm">
                                <a href={d4hUrl} target="_blank" rel="noreferrer">
                                    <ExternalLinkIcon />
                                    Open in D4H
                                </a>
                            </Button>
                            <D4HModule_EquipmentItem_Menu canUpdateInD4H={canUpdateInD4H} />
                            {actions}
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
                                            <DataItemValue>#{item.ref}</DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Type</DataItemTitle>
                                            <DataItemValue>{item.kind.title}</DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Category</DataItemTitle>
                                            <DataItemValue>
                                                {categories.find((c) => c.id === item.category.id)
                                                    ?.title ?? "—"}
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Brand</DataItemTitle>
                                            <DataItemValue>{item.brand.title}</DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Model</DataItemTitle>
                                            <DataItemValue>{item.model?.title}</DataItemValue>
                                        </DataItem>
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
                                                {holder
                                                    ? // A holder missing from the team's member
                                                      // list (e.g. a retired member) has no name.
                                                      (holder.name ?? `Member #${holder.id}`)
                                                    : (item.location?.resourceType ?? "—")}
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
