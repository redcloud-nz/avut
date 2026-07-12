/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-views/equipment/categories/[category_id]/kinds/[kind_id]
 */
"use client";

import { use } from "react";

import { eq, useLiveSuspenseQuery } from "@tanstack/react-db";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DL, DLDetails, DLTerm } from "@/components/ui/description-list";

import { useOrganization } from "@/hooks/use-organization";
import { getD4HEquipmentKindsCollection } from "@/lib/collections/d4h-equipment-kinds";
import { route } from "@/lib/routes";
import { D4HViewsModule_EquipmentKind_Items_List } from "./kind-items";

export default function D4HViewsModule_EquipmentCategory_Kind_Page(
    props: PageProps<"/orgs/[slug]/d4h-views/equipment/categories/[category_id]/kinds/[kind_id]">,
) {
    const { category_id, kind_id } = use(props.params);
    const categoryId = parseInt(category_id, 10);
    const kindId = parseInt(kind_id, 10);

    const organization = useOrganization();

    const { data: kind } = useLiveSuspenseQuery((q) =>
        q
            .from({
                kind: getD4HEquipmentKindsCollection(organization.id),
            })
            .where(({ kind }) => eq(kind.id, kindId))
            .findOne(),
    );

    if (!kind) throw new Error(`Kind(${kindId}) not found`);

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    {
                        label: "D4H Views",
                        href: route("/orgs/[slug]/d4h-views", { slug: organization.slug }),
                    },
                    {
                        label: "Equipment",
                        href: route("/orgs/[slug]/d4h-views/equipment", {
                            slug: organization.slug,
                        }),
                    },
                    {
                        label: "Categories",
                        href: route("/orgs/[slug]/d4h-views/equipment/categories", {
                            slug: organization.slug,
                        }),
                    },
                    {
                        label: kind.category.title,
                        href: route("/orgs/[slug]/d4h-views/equipment/categories/[category_id]", {
                            slug: organization.slug,
                            category_id: String(categoryId),
                        }),
                    },
                    "Kinds",
                    kind.title,
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>{kind.title}</Saratoga.Title>
                    </Saratoga.Header>
                    <Card>
                        <CardHeader>
                            <CardTitle>Kind Details</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DL>
                                <DLTerm>Kind ID</DLTerm>
                                <DLDetails>{kind.id}</DLDetails>
                                <DLTerm>Title</DLTerm>
                                <DLDetails>{kind.title}</DLDetails>
                                <DLTerm>Category</DLTerm>
                                <DLDetails>{kind.category.title}</DLDetails>
                                <DLTerm>Owner</DLTerm>
                                <DLDetails>
                                    <span>{kind.owner.title}</span>
                                    <span className="text-muted-foreground pl-2">
                                        ({kind.owner.resourceType})
                                    </span>
                                </DLDetails>
                            </DL>
                        </CardContent>
                    </Card>
                    <D4HViewsModule_EquipmentKind_Items_List kindId={kind.id} />
                </Saratoga.Root>
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
