/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/d4h-views/equipment/categories/[category_id]/kinds/[kind_id]
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
import { getD4HEquipmentKindsCollection } from "@/lib/collections/d4h-equipment-kinds";
import { route } from "@/lib/routes";
import { D4HViewsModule_EquipmentKind_Items_List } from "./kind-items";

export default function D4HViewsModule_EquipmentCategory_Kind_Page(
    props: PageProps<"/main/[slug]/d4h-views/equipment/categories/[category_id]/kinds/[kind_id]">,
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
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    {
                        label: "D4H Views",
                        href: route("/main/[slug]/d4h-views", { slug: organization.slug }),
                    },
                    {
                        label: "Equipment",
                        href: route("/main/[slug]/d4h-views/equipment", {
                            slug: organization.slug,
                        }),
                    },
                    {
                        label: "Categories",
                        href: route("/main/[slug]/d4h-views/equipment/categories", {
                            slug: organization.slug,
                        }),
                    },
                    {
                        label: kind.category.title,
                        href: route("/main/[slug]/d4h-views/equipment/categories/[category_id]", {
                            slug: organization.slug,
                            category_id: String(categoryId),
                        }),
                    },
                    "Kinds",
                    kind.title,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="xl">
                    <Hermes.Header>
                        <Hermes.BackButton
                            href={route(
                                "/main/[slug]/d4h-views/equipment/categories/[category_id]",
                                { slug: organization.slug, category_id: String(categoryId) },
                            )}
                            tooltip={`Back to category ${kind.category.title}`}
                        />
                        <Hermes.Title>{kind.title}</Hermes.Title>
                    </Hermes.Header>
                    <Card>
                        <CardHeader>
                            <CardTitle>Kind Details</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <FieldGroup>
                                <Field orientation="responsive">
                                    <FieldLabel>Kind ID</FieldLabel>
                                    <FieldValue value={kind.id} format="id" />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Title</FieldLabel>
                                    <FieldValue value={kind.title} />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Category</FieldLabel>
                                    <FieldValue value={kind.category.title} />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Owner</FieldLabel>
                                    <FieldValue>
                                        <span>{kind.owner.title}</span>
                                        <span className="text-muted-foreground pl-2">
                                            ({kind.owner.resourceType})
                                        </span>
                                    </FieldValue>
                                </Field>
                            </FieldGroup>
                        </CardContent>
                    </Card>
                    <D4HViewsModule_EquipmentKind_Items_List kindId={kind.id} />
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
