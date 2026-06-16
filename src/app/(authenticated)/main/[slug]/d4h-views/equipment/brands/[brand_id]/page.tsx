/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/d4h-views/equipment/brands/[brand_id]
 */
"use client";

import { use } from "react";

import { eq, useLiveSuspenseQuery } from "@tanstack/react-db";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DL, DLDetails, DLTerm } from "@/components/ui/description-list";

import { useOrganization } from "@/hooks/use-organization";
import { getD4HEquipmentBrandsCollection } from "@/lib/collections/equipment-brands";
import { formatDateTime } from "@/lib/datetime";
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
        <Std.SidebarInset>
            <Std.Navbar
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
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>{brand.title}</Saratoga.Title>
                    </Saratoga.Header>
                    <Card>
                        <CardHeader>
                            <CardTitle>Brand Details</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DL>
                                <DLTerm>Brand ID</DLTerm>
                                <DLDetails>{brand.id}</DLDetails>
                                <DLTerm>Title</DLTerm>
                                <DLDetails>{brand.title}</DLDetails>
                                <DLTerm>Owner</DLTerm>
                                <DLDetails>
                                    <span>{brand.owner.title}</span>
                                    <span className="text-muted-foreground pl-2">
                                        ({brand.owner.resourceType})
                                    </span>
                                </DLDetails>
                                <DLTerm>Updated</DLTerm>
                                <DLDetails>{formatDateTime(brand.updatedAt)}</DLDetails>
                            </DL>
                        </CardContent>
                    </Card>
                    <D4HViewsModule_EquipmentBrand_Models_List brandId={brand.id} />
                </Saratoga.Root>
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
