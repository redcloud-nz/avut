/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { notFound } from "next/navigation";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Badge } from "@/components/ui/badge";
import { CardContent } from "@/components/ui/card";
import {
    DataItem,
    DataItemDateValue,
    DataItemTitle,
    DataItemValue,
    DataList,
} from "@/components/ui/data-item";
import { RecordCard, RecordCardId } from "@/components/ui/record-card";
import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { trpc } from "@/trpc/client";

import { UserSettings_Organization_Menu } from "./organization-menu";

export function UserSettings_OrganizationContent({
    organizationId,
}: {
    organizationId: OrganizationId;
}) {
    const { data: memberships } = useSuspenseQuery(trpc.user.listMemberships.queryOptions());
    const membership = memberships.find((m) => m.organization.id === organizationId);

    if (!membership) notFound();

    const { organization } = membership;

    return (
        <Saratoga.Root>
            <Saratoga.Breadcrumbs
                items={[{ label: "Organisations", href: "/user/settings/organizations" }]}
            />
            <Saratoga.Header>
                <Saratoga.Title>{organization.name}</Saratoga.Title>
            </Saratoga.Header>
            {/* Nothing for a secondary column: full width. */}
            <RecordCard
                label="Organisation"
                action={<UserSettings_Organization_Menu membership={membership} />}
            >
                <CardContent>
                    <DataList>
                        <RecordCardId label="Organisation ID" id={organization.id} />
                        <DataItem>
                            <DataItemTitle>Name</DataItemTitle>
                            <DataItemValue>{organization.name}</DataItemValue>
                        </DataItem>
                        <DataItem>
                            <DataItemTitle>Slug</DataItemTitle>
                            <DataItemValue className="font-mono">{organization.slug}</DataItemValue>
                        </DataItem>
                        <DataItem>
                            <DataItemTitle>Your Roles</DataItemTitle>
                            <DataItemValue>
                                <div className="flex flex-wrap gap-1">
                                    {membership.roles.map((role) => (
                                        <Badge key={role} variant="secondary">
                                            {OrganizationRole.displayNames[role]}
                                        </Badge>
                                    ))}
                                </div>
                            </DataItemValue>
                        </DataItem>
                        <DataItem>
                            <DataItemTitle>Joined</DataItemTitle>
                            <DataItemDateValue date={membership.createdAt} />
                        </DataItem>
                    </DataList>
                </CardContent>
            </RecordCard>
        </Saratoga.Root>
    );
}
