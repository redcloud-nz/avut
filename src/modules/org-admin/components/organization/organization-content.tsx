/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";
import { useRef } from "react";

import { Protect } from "@/components/protect";
import { CardContent } from "@/components/ui/card";
import { DataItem, DataItemTitle, DataItemValue, DataList } from "@/components/ui/data-item";
import { RecordCard, RecordCardId } from "@/components/ui/record-card";
import { RecordCardEditButton } from "@/components/ui/record-card-actions";
import { route } from "@/lib/routes";
import type { OrganizationData } from "@/lib/schemas/organization";
import { AdminModule_Organization_D4HCard } from "@/modules/org-admin/components/organization/d4h-org-card";

/**
 * The organisation page's cards, full width (nothing for a secondary column): the Organisation
 * card, whose pencil (⌥E) opens the `--update` route, and the D4H Integration card. There's no ⋮:
 * the organisation has no other actions.
 */
export function AdminModule_Organization_Content({
    organization,
}: {
    organization: Pick<OrganizationData, "id" | "name" | "slug">;
}) {
    // The pencil: where the D4H card's Unlink dialog returns focus once the card has gone. Both
    // need `organization: ["update"]`.
    const editButtonRef = useRef<HTMLButtonElement>(null);

    return (
        <div className="space-y-4">
            <RecordCard
                label="Organisation"
                action={
                    <Protect permissions={{ organization: ["update"] }}>
                        <RecordCardEditButton
                            ref={editButtonRef}
                            label="Edit organisation"
                            category="Organisation"
                            primary
                            asChild
                        >
                            <Link
                                href={route("/orgs/[slug]/admin/organization/--update", {
                                    slug: organization.slug,
                                })}
                            />
                        </RecordCardEditButton>
                    </Protect>
                }
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
                    </DataList>
                </CardContent>
            </RecordCard>
            <AdminModule_Organization_D4HCard returnFocusRef={editButtonRef} />
        </div>
    );
}
