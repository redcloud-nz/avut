/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
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
import { route } from "@/lib/routes";
import { I3TemplateId } from "@/lib/schemas/i3-template";
import { trpc } from "@/trpc/client";

import { I3Module_Template_Menu } from "./template-menu";
import { I3Module_Template_Variants_List } from "./template-variants";
import { I3Module_UpdateTemplate_Dialog } from "./update-template";

export function I3Module_Template_Content({ templateId }: { templateId: I3TemplateId }) {
    const organization = useOrganization();
    const slug = organization.slug;

    const { data: template } = useSuspenseQuery(
        trpc.i3.getTemplate.queryOptions({ organizationId: organization.id, templateId }),
    );

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    { label: "I3", href: route("/orgs/[slug]/i3", { slug }) },
                    { label: "Templates", href: route("/orgs/[slug]/i3/templates", { slug }) },
                    template.name,
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>{template.name}</Saratoga.Title>
                        <Saratoga.Actions>
                            <I3Module_Template_Menu template={template} />
                        </Saratoga.Actions>
                    </Saratoga.Header>

                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Template Details</CardTitle>
                                    <CardAction>
                                        <Protect permissions={{ i3Template: ["update"] }}>
                                            <I3Module_UpdateTemplate_Dialog template={template} />
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
                                            <DataItemValue>
                                                {template.d4h?.categoryTitle}
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>D4H Kind</DataItemTitle>
                                            <DataItemValue>{template.d4h?.kindTitle}</DataItemValue>
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
                            <I3Module_Template_Variants_List template={template} />
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
