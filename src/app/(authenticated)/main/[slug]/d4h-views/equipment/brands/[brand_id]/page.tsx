/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/d4h-views/equipment/brands/[brand_id]
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
import { getD4HEquipmentBrandsCollection } from "@/lib/collections/equipment-brands";
import { route } from "@/lib/routes";

import { D4HViewsModule_EquipmentBrand_Models_List } from "./brand-models";

export default function D4HViewsModule_EquipmentBrand_Page(
    props: PageProps<"/main/[slug]/d4h-views/equipment/brands/[brand_id]">,
) {
    const { brand_id } = use(props.params);
    const brandId = parseInt(brand_id, 10);

    const organization = useOrganization();

    const { data: brand } = useLiveSuspenseQuery((q) =>
        q
            .from({
                brand: getD4HEquipmentBrandsCollection(organization.id),
            })
            .where(({ brand }) => eq(brand.id, brandId))
            .findOne(),
    );

    if (!brand) throw new Error(`Brand(${brandId}) not found`);

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
                        label: "Brands",
                        href: route("/main/[slug]/d4h-views/equipment/brands", {
                            slug: organization.slug,
                        }),
                    },
                    brand.title,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="xl">
                    <Hermes.Header>
                        <Hermes.BackButton
                            href={route("/main/[slug]/d4h-views/equipment/brands", {
                                slug: organization.slug,
                            })}
                        />
                        <Hermes.Title>{brand.title}</Hermes.Title>
                    </Hermes.Header>
                    <Card>
                        <CardHeader>
                            <CardTitle>Brand Details</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <FieldGroup>
                                <Field orientation="responsive">
                                    <FieldLabel>Brand ID</FieldLabel>
                                    <FieldValue value={brand.id} format="id" />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Title</FieldLabel>
                                    <FieldValue value={brand.title} />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Owner</FieldLabel>
                                    <FieldValue>
                                        <span>{brand.owner.title}</span>
                                        <span className="text-muted-foreground pl-2">
                                            ({brand.owner.resourceType})
                                        </span>
                                    </FieldValue>
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Updated</FieldLabel>
                                    <FieldValue value={brand.updatedAt} format="datetime" />
                                </Field>
                            </FieldGroup>
                        </CardContent>
                    </Card>
                    <D4HViewsModule_EquipmentBrand_Models_List brandId={brand.id} />
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
