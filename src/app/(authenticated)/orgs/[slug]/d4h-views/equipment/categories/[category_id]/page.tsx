/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-views/equipment/categories/[category_id]
 */
"use client";

import { use } from "react";

import { eq, useLiveSuspenseQuery } from "@tanstack/react-db";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";

import { useOrganization } from "@/hooks/use-organization";
import { getD4HEquipmentCategoriesCollection } from "@/lib/collections/d4h-equipment-categories";
import * as Paths from "@/paths";

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
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(organization.slug).d4HViews.index,
                    Paths.org(organization.slug).d4HViews.equipment.index,
                    Paths.org(organization.slug).d4HViews.equipment.categories,
                    category.title,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="xl">
                    <Hermes.Header>
                        <Hermes.BackButton
                            to={
                                Paths.org(organization.slug).d4HViews.equipment
                                    .categories
                            }
                            tooltip="Back to categories"
                        />
                        <Hermes.Title>{category.title}</Hermes.Title>
                    </Hermes.Header>
                    <Card>
                        <CardHeader>
                            <CardTitle>Category Details</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <FieldGroup>
                                <Field orientation="responsive">
                                    <FieldLabel>Category ID</FieldLabel>
                                    <FieldValue
                                        value={category.id}
                                        format="id"
                                    />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Title</FieldLabel>
                                    <FieldValue value={category.title} />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Owner</FieldLabel>
                                    <FieldValue>
                                        <span>{category.owner.title}</span>
                                        <span className="text-muted-foreground pl-2">
                                            ({category.owner.resourceType})
                                        </span>
                                    </FieldValue>
                                </Field>
                            </FieldGroup>
                        </CardContent>
                    </Card>
                    <D4HViewsModule_EquipmentCategory_Kinds_List
                        categoryId={category.id}
                    />
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
