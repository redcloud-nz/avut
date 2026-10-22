/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ExternalLinkIcon } from "lucide-react";
import { Suspense } from "react";

import { useSuspenseQueries } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";
import {
    Card,
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

import { I3Module_ReturnedBadge } from "../returned-badge";

import { I3Module_ItemTasks_Card } from "./item-tasks-card";
import { I3Module_UpdateEquipmentItem_Dialog } from "./update-equipment-item";

/**
 * A D4H equipment item, read live from D4H with the viewer's token.
 */
export function I3Module_EquipmentItem_Content({
    teamId,
    itemId,
}: {
    teamId: number;
    itemId: number;
}) {
    const organization = useOrganization();
    const slug = organization.slug;
    const { formatDate } = usePreferences();

    const [
        {
            data: { item, d4hUrl },
        },
        { data: teams },
        { data: returnedItemIds },
        { data: categories },
    ] = useSuspenseQueries({
        queries: [
            trpc.d4hApi.getEquipmentItem.queryOptions({
                organizationId: organization.id,
                teamId,
                itemId,
            }),
            trpc.d4hApi.listAccessibleTeams.queryOptions({ organizationId: organization.id }),
            trpc.d4hTasks.listReturnedItemIds.queryOptions({
                organizationId: organization.id,
                teamId,
            }),
            // The single-item GET doesn't reliably expand the kind's category, so the name
            // comes from the category list (the member page does the same).
            trpc.d4hApi.listEquipmentCategories.queryOptions({ organizationId: organization.id }),
        ],
    });

    const team = teams.find((t) => t.id === teamId);
    if (!team) throw new Error(`D4HTeam(${teamId}) not found`);

    const isReturned = returnedItemIds.includes(item.id);
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
                    { label: "I3", href: route("/orgs/[slug]/i3", { slug }) },
                    {
                        label: team.title,
                        href: route("/orgs/[slug]/i3/teams/[team_id]", {
                            slug,
                            team_id: String(teamId),
                        }),
                    },
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
                            <Protect
                                permissions={{ i3Item: ["update"] }}
                                render={(hasPermission) => (
                                    <I3Module_UpdateEquipmentItem_Dialog
                                        teamId={teamId}
                                        item={item}
                                        disabledReason={
                                            !hasPermission
                                                ? "Editing items needs the I3 Editor or I3 Admin role."
                                                : !canUpdateInD4H
                                                  ? `Your D4H account doesn't have the Equipment Update permission on ${team.title}.`
                                                  : null
                                        }
                                    />
                                )}
                            />
                            <Button asChild variant="outline">
                                <a href={d4hUrl} target="_blank" rel="noreferrer">
                                    <ExternalLinkIcon />
                                    Open in D4H
                                </a>
                            </Button>
                        </Saratoga.Actions>
                    </Saratoga.Header>

                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Item Information</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <DataList>
                                        <DataItem inline>
                                            <DataItemTitle>Ref</DataItemTitle>
                                            <DataItemValue>#{item.ref}</DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Kind</DataItemTitle>
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
                                                {isReturned && <I3Module_ReturnedBadge />}
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
                            <Protect permissions={{ i3Item: ["update"] }}>
                                <Suspense fallback={<CardLoadingFallback />}>
                                    <I3Module_ItemTasks_Card
                                        teamId={teamId}
                                        itemId={itemId}
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
