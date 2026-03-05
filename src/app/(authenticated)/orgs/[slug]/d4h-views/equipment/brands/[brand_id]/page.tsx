/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-views/equipment/brands/[brand_id]
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
import * as Paths from "@/paths";

import { D4HViewsModule_EquipmentBrand_Models_List } from "./brand-models";

export default function D4HViewsModule_EquipmentBrand_Page(
    props: PageProps<"/orgs/[slug]/d4h-views/equipment/brands/[brand_id]">,
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
                    Paths.org(organization.slug).d4hViews.index,
                    Paths.org(organization.slug).d4hViews.equipment.index,
                    Paths.org(organization.slug).d4hViews.equipment.brands,
                    brand.title,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="xl">
                    <Hermes.Header>
                        <Hermes.BackButton
                            to={
                                Paths.org(organization.slug).d4hViews.equipment
                                    .brands
                            }
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
                                    <FieldValue
                                        value={brand.updatedAt}
                                        format="datetime"
                                    />
                                </Field>
                            </FieldGroup>
                        </CardContent>
                    </Card>
                    <D4HViewsModule_EquipmentBrand_Models_List
                        brandId={brand.id}
                    />
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
