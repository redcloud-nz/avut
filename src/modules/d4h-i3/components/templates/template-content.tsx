/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { D4HEquipmentCategoryLink } from "@/components/entity-links/d4h-equipment-category-link";
import { D4HEquipmentTypeLink } from "@/components/entity-links/d4h-equipment-type-link";
import { Protect } from "@/components/protect";
import { CardContent } from "@/components/ui/card";
import { DataItem, DataItemTitle, DataItemValue, DataList } from "@/components/ui/data-item";
import { RecordCard, RecordCardId } from "@/components/ui/record-card";
import { RecordStatusBadge } from "@/components/ui/status-badge";
import { useOrganization } from "@/hooks/use-organization";
import { usesOtherRecords } from "@/lib/i3-template-fit";
import { route } from "@/lib/routes";
import { I3BrandModelRule, I3TemplateId } from "@/lib/schemas/i3-template";
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
        <Saratoga.Root>
            <Saratoga.Breadcrumbs
                items={[
                    {
                        label: "I3 Templates",
                        href: route("/orgs/[slug]/d4h-i3/templates", { slug }),
                    },
                ]}
            />
            <Saratoga.Header>
                <Saratoga.Title
                    badges={
                        <>
                            <RecordStatusBadge status={template.status} />
                            {flagged && <D4HI3Module_OtherRecords_Badge />}
                        </>
                    }
                >
                    {template.name}
                </Saratoga.Title>
                <Saratoga.Actions>
                    <D4HI3Module_Template_Menu template={template} />
                </Saratoga.Actions>
            </Saratoga.Header>

            <Saratoga.Columns>
                <Saratoga.Column slot="main">
                    <RecordCard
                        label="I3 Template"
                        updatedAt={template.updatedAt}
                        action={
                            <Protect permissions={{ i3Template: ["update"] }}>
                                <D4HI3Module_UpdateTemplate_Dialog template={template} />
                            </Protect>
                        }
                    >
                        <CardContent>
                            <DataList>
                                <RecordCardId label="Template ID" id={template.id} />
                                <DataItem>
                                    <DataItemTitle>Name</DataItemTitle>
                                    <DataItemValue>{template.name}</DataItemValue>
                                </DataItem>
                                {template.description && (
                                    <DataItem>
                                        <DataItemTitle>Description</DataItemTitle>
                                        <DataItemValue>{template.description}</DataItemValue>
                                    </DataItem>
                                )}
                                <DataItem>
                                    <DataItemTitle>D4H Category</DataItemTitle>
                                    <DataItemValue>
                                        {template.d4h ? (
                                            <D4HEquipmentCategoryLink
                                                category={{
                                                    id: template.d4h.categoryId,
                                                    title: template.d4h.categoryTitle,
                                                    owner: categoryOwner,
                                                }}
                                            />
                                        ) : (
                                            "—"
                                        )}
                                    </DataItemValue>
                                </DataItem>
                                <DataItem>
                                    <DataItemTitle>D4H Type</DataItemTitle>
                                    <DataItemValue>
                                        {template.d4h ? (
                                            <D4HEquipmentTypeLink
                                                type={{
                                                    id: template.d4h.kindId,
                                                    title: template.d4h.kindTitle,
                                                    owner: kindOwner,
                                                }}
                                            />
                                        ) : (
                                            "—"
                                        )}
                                    </DataItemValue>
                                </DataItem>
                                <DataItem>
                                    <DataItemTitle>Require Serial Number</DataItemTitle>
                                    <DataItemValue>
                                        {template.d4h?.requireSN ? "Yes" : "No"}
                                    </DataItemValue>
                                </DataItem>
                                <DataItem>
                                    <DataItemTitle>Brand &amp; Model</DataItemTitle>
                                    <DataItemValue>
                                        {template.d4h
                                            ? I3BrandModelRule.label[template.d4h.brandModelRule]
                                            : "—"}
                                    </DataItemValue>
                                </DataItem>
                            </DataList>
                        </CardContent>
                    </RecordCard>
                    <D4HI3Module_Template_Variants_List template={template} />
                </Saratoga.Column>
            </Saratoga.Columns>
        </Saratoga.Root>
    );
}
