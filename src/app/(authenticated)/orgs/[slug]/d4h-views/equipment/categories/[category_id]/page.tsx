/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-views/equipment/categories/[category_id]
 */
"use client";

import { use } from "react";

import { eq, useLiveSuspenseQuery } from "@tanstack/react-db";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DL, DLDetails, DLTerm } from "@/components/ui/description-list";

import { useOrganization } from "@/hooks/use-organization";
import { getD4HEquipmentCategoriesCollection } from "@/lib/collections/d4h-equipment-categories";
import { route } from "@/lib/routes";

import { D4HViewsModule_EquipmentCategory_Kinds_List } from "./category-kinds";

export default function D4HViewsModule_EquipmentCategory_Page(
    props: PageProps<"/orgs/[slug]/d4h-views/equipment/categories/[category_id]">,
) {
    const { category_id } = use(props.params);
    const categoryId = parseInt(category_id, 10);

    const organization = useOrganization();

    const { data: category } = useLiveSuspenseQuery((q) =>
        q
            .from({
                category: getD4HEquipmentCategoriesCollection(organization.id),
            })
            .where(({ category }) => eq(category.id, categoryId))
            .findOne(),
    );

    if (!category) throw new Error(`Category(${categoryId}) not found`);

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
                    category.title,
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>{category.title}</Saratoga.Title>
                    </Saratoga.Header>
                    <Card>
                        <CardHeader>
                            <CardTitle>Category Details</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DL>
                                <DLTerm>Category ID</DLTerm>
                                <DLDetails>{category.id}</DLDetails>
                                <DLTerm>Title</DLTerm>
                                <DLDetails>{category.title}</DLDetails>
                                <DLTerm>Owner</DLTerm>
                                <DLDetails>
                                    <span>{category.owner.title}</span>
                                    <span className="text-muted-foreground pl-2">
                                        ({category.owner.resourceType})
                                    </span>
                                </DLDetails>
                            </DL>
                        </CardContent>
                    </Card>
                    <D4HViewsModule_EquipmentCategory_Kinds_List categoryId={category.id} />
                </Saratoga.Root>
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
