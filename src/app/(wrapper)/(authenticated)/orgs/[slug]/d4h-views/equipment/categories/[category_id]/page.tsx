/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-views/equipment/categories/[category_id]
 */
"use client";

import { use } from "react";

import { eq, useLiveSuspenseQuery } from "@tanstack/react-db";

import { getD4HEquipmentCategoriesCollection } from "@/client/collections/d4h-equipment-categories";
import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataItem, DataItemTitle, DataItemValue, DataList } from "@/components/ui/data-item";
import { useOrganization } from "@/hooks/use-organization";
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
        <>
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
                            <DataList>
                                <DataItem inline>
                                    <DataItemTitle>Category ID</DataItemTitle>
                                    <DataItemValue>{category.id}</DataItemValue>
                                </DataItem>
                                <DataItem inline>
                                    <DataItemTitle>Title</DataItemTitle>
                                    <DataItemValue>{category.title}</DataItemValue>
                                </DataItem>
                                <DataItem inline>
                                    <DataItemTitle>Owner</DataItemTitle>
                                    <DataItemValue>
                                        <span>{category.owner.title}</span>
                                        <span className="text-muted-foreground pl-2">
                                            ({category.owner.resourceType})
                                        </span>
                                    </DataItemValue>
                                </DataItem>
                            </DataList>
                        </CardContent>
                    </Card>
                    <D4HViewsModule_EquipmentCategory_Kinds_List categoryId={category.id} />
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
