/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { D4HOwner } from "@/components/d4h/d4h-owner";
import { D4HEquipmentCategoryLink } from "@/components/entity-links/d4h-equipment-category-link";
import { D4HEquipmentTypeLink } from "@/components/entity-links/d4h-equipment-type-link";
import { Protect } from "@/components/protect";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    DataItem,
    DataItemDateValue,
    DataItemTitle,
    DataItemValue,
    DataList,
} from "@/components/ui/data-item";
import { useOrganization } from "@/hooks/use-organization";
import { usesOtherRecords } from "@/lib/i3-template-fit";
import { route } from "@/lib/routes";
import { I3TemplateId } from "@/lib/schemas/i3-template";
import { useOrganisationOnlyId } from "@/modules/d4h-i3/lib/use-organisation-only-id";
import { trpc } from "@/trpc/client";

import { D4HI3Module_OtherRecords_Badge } from "./other-records-flag";
import { D4HI3Module_Template_Menu } from "./template-menu";
import { D4HI3Module_Template_Variants_List } from "./template-variants";
import { D4HI3Module_UpdateTemplate_Dialog } from "./update-template";

export function D4HI3Module_Template_Content({ templateId }: { templateId: I3TemplateId }) {
    const organization = useOrganization();
    const slug = organization.slug;

    const { data: template } = useSuspenseQuery(
        trpc.i3.getTemplate.queryOptions({ organizationId: organization.id, templateId }),
    );

    // Not suspending: owners and the flag are extras, so a D4H failure leaves them out rather
    // than blanking the page.
    const { data: categories } = useQuery(
        trpc.d4hApi.listEquipmentCategories.queryOptions({ organizationId: organization.id }),
    );
    const { data: kinds } = useQuery(
        trpc.d4hApi.listEquipmentKinds.queryOptions({ organizationId: organization.id }),
    );
    const organisationOnlyId = useOrganisationOnlyId();

    const categoryOwner = categories?.find((c) => c.id === template.d4h?.categoryId)?.owner;
    const kindOwner = kinds?.find((k) => k.id === template.d4h?.kindId)?.owner;
    const flagged =
        organisationOnlyId != null &&
        categories != null &&
        kinds != null &&
        usesOtherRecords(template.d4h, { categories, kinds }, organisationOnlyId);

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    { label: "D4H I3", href: route("/orgs/[slug]/d4h-i3", { slug }) },
                    { label: "Templates", href: route("/orgs/[slug]/d4h-i3/templates", { slug }) },
                    template.name,
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>{template.name}</Saratoga.Title>
                        <Saratoga.Actions>
                            <D4HI3Module_Template_Menu template={template} />
                        </Saratoga.Actions>
                    </Saratoga.Header>

                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex flex-wrap items-center gap-2">
                                        Template Details
                                        {flagged && <D4HI3Module_OtherRecords_Badge />}
                                    </CardTitle>
                                    <CardAction>
                                        <Protect permissions={{ i3Template: ["update"] }}>
                                            <D4HI3Module_UpdateTemplate_Dialog
                                                template={template}
                                            />
                                        </Protect>
                                    </CardAction>
                                </CardHeader>
                                <CardContent>
                                    <DataList>
                                        <DataItem inline>
                                            <DataItemTitle>Name</DataItemTitle>
                                            <DataItemValue>{template.name}</DataItemValue>
                                        </DataItem>
                                        {template.description && (
                                            <DataItem>
                                                <DataItemTitle>Description</DataItemTitle>
                                                <DataItemValue>
                                                    {template.description}
                                                </DataItemValue>
                                            </DataItem>
                                        )}
                                        <DataItem inline>
                                            <DataItemTitle>D4H Category</DataItemTitle>
                                            <DataItemValue className="flex items-baseline gap-2">
                                                {template.d4h ? (
                                                    <D4HEquipmentCategoryLink
                                                        category={{
                                                            id: template.d4h.categoryId,
                                                            title: template.d4h.categoryTitle,
                                                        }}
                                                    />
                                                ) : (
                                                    "—"
                                                )}
                                                {categoryOwner && (
                                                    <span className="ml-auto">
                                                        <D4HOwner
                                                            owner={categoryOwner}
                                                            variant="compact"
                                                        />
                                                    </span>
                                                )}
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>D4H Type</DataItemTitle>
                                            <DataItemValue className="flex items-baseline gap-2">
                                                {template.d4h ? (
                                                    <D4HEquipmentTypeLink
                                                        type={{
                                                            id: template.d4h.kindId,
                                                            title: template.d4h.kindTitle,
                                                        }}
                                                    />
                                                ) : (
                                                    "—"
                                                )}
                                                {kindOwner && (
                                                    <span className="ml-auto">
                                                        <D4HOwner
                                                            owner={kindOwner}
                                                            variant="compact"
                                                        />
                                                    </span>
                                                )}
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Require Serial Number</DataItemTitle>
                                            <DataItemValue>
                                                {template.d4h?.requireSN ? "Yes" : "No"}
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Status</DataItemTitle>
                                            <DataItemValue>{template.status}</DataItemValue>
                                        </DataItem>
                                    </DataList>
                                </CardContent>
                            </Card>
                            <D4HI3Module_Template_Variants_List template={template} />
                        </Saratoga.Column>
                        <Saratoga.Column slot="secondary">
                            <Card>
                                <CardContent>
                                    <DataList>
                                        <DataItem inline>
                                            <DataItemTitle>Created</DataItemTitle>
                                            <DataItemDateValue date={template.createdAt} />
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Updated</DataItemTitle>
                                            <DataItemDateValue date={template.updatedAt} />
                                        </DataItem>
                                    </DataList>
                                </CardContent>
                            </Card>
                        </Saratoga.Column>
                    </Saratoga.Columns>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
