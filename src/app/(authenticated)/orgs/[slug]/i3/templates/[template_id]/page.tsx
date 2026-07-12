/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-ppe/templates/[template_id]
 */
"use client";

import { use } from "react";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Protect } from "@/components/protect";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DL, DLDetails, DLTerm } from "@/components/ui/description-list";

import { useOrganization } from "@/hooks/use-organization";
import { useI3Template } from "@/hooks/use-i3-template";
import { formatDateTime, formatRelativeDateTime } from "@/lib/datetime";
import { route } from "@/lib/routes";

import { I3Module_Template_Menu } from "./template-menu";
import { I3Module_UpdateTemplate_Dialog } from "./update-template";
import { I3Module_Template_Variants_List } from "./template-variants";

export default function I3Module_Template_Page(
    props: PageProps<"/orgs/[slug]/i3/templates/[template_id]">,
) {
    const { slug, template_id } = use(props.params);
    const organization = useOrganization();
    const template = useI3Template(template_id);

    return (
        <Std.SidebarInset>
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
                                        <Protect
                                            orgId={organization.id}
                                            permissions={{ i3Template: ["update"] }}
                                        >
                                            <I3Module_UpdateTemplate_Dialog template={template} />
                                        </Protect>
                                    </CardAction>
                                </CardHeader>
                                <CardContent>
                                    <DL>
                                        <DLTerm>Name</DLTerm>
                                        <DLDetails>{template.name}</DLDetails>
                                        {template.description && (
                                            <>
                                                <DLTerm>Description</DLTerm>
                                                <DLDetails>{template.description}</DLDetails>
                                            </>
                                        )}
                                        <DLTerm>D4H Category</DLTerm>
                                        <DLDetails>{template.d4h?.categoryTitle}</DLDetails>
                                        <DLTerm>D4H Kind</DLTerm>
                                        <DLDetails>{template.d4h?.kindTitle}</DLDetails>
                                        <DLTerm>Require Serial Number</DLTerm>
                                        <DLDetails>
                                            {template.d4h?.requireSN ? "Yes" : "No"}
                                        </DLDetails>
                                        <DLTerm>Status</DLTerm>
                                        <DLDetails>{template.status}</DLDetails>
                                    </DL>
                                </CardContent>
                            </Card>
                            <I3Module_Template_Variants_List template={template} />
                        </Saratoga.Column>
                        <Saratoga.Column slot="secondary">
                            <Card>
                                <CardContent>
                                    <DL>
                                        <DLTerm>Created</DLTerm>
                                        <DLDetails>
                                            <div>{formatDateTime(template.createdAt)}</div>
                                            <div className="text-muted-foreground">
                                                {formatRelativeDateTime(template.createdAt)}
                                            </div>
                                        </DLDetails>
                                        <DLTerm>Updated</DLTerm>
                                        <DLDetails>
                                            <div>{formatDateTime(template.updatedAt)}</div>
                                            <div className="text-muted-foreground">
                                                {formatRelativeDateTime(template.updatedAt)}
                                            </div>
                                        </DLDetails>
                                    </DL>
                                </CardContent>
                            </Card>
                        </Saratoga.Column>
                    </Saratoga.Columns>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
