/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-ppe/templates/[template_id]
 */
"use client";

import { use, useState } from "react";

import { useQuery } from "@tanstack/react-query";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import { ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardAction,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
    FieldLegend,
    FieldSeparator,
    FieldSet,
} from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";
import { Link } from "@/components/ui/link";

import { useOrganization } from "@/hooks/use-organization";
import { useI3Template } from "@/hooks/use-i3-template";
import { I3Template } from "@/lib/schemas/i3-template";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

import { I3Module_Template_Menu } from "./template-menu";
import { I3Module_Template_Variants_List } from "./template-variants";

export default function I3Module_Template_Page(
    props: PageProps<"/orgs/[slug]/i3/templates/[template_id]">,
) {
    const { slug, template_id } = use(props.params);
    const organization = useOrganization();
    const template = useI3Template(template_id);

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).i3.index,
                    Paths.org(slug).i3.templates,
                    template.name,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Header>
                        <Hermes.BackButton
                            to={Paths.org(slug).i3.templates}
                            tooltip="Back to templates"
                        />
                        <Hermes.Title>{template.name}</Hermes.Title>
                        <Hermes.Action>
                            <I3Module_Template_Menu template={template} />
                        </Hermes.Action>
                    </Hermes.Header>
                    <Card>
                        <CardHeader>
                            <CardTitle>Template Details</CardTitle>
                            <CardAction className="flex gap-2">
                                <Protect
                                    orgId={organization.id}
                                    permissions={{ i3Template: ["update"] }}
                                >
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        tooltip="Edit template"
                                        asChild
                                    >
                                        <Link
                                            to={
                                                Paths.org(slug).i3.template(
                                                    template.id,
                                                ).update
                                            }
                                        >
                                            <ObjectIcons.Edit />
                                        </Link>
                                    </Button>
                                </Protect>
                            </CardAction>
                        </CardHeader>
                        <CardContent>
                            <FieldGroup>
                                <Field orientation="responsive">
                                    <FieldLabel>Name</FieldLabel>
                                    <FieldValue value={template.name} />
                                </Field>
                                {template.description && (
                                    <Field orientation="responsive">
                                        <FieldLabel>Description</FieldLabel>
                                        <FieldValue
                                            value={template.description}
                                        />
                                    </Field>
                                )}

                                <Field orientation="responsive">
                                    <FieldLabel>D4H Category</FieldLabel>
                                    <FieldValue
                                        value={
                                            template.d4h?.categoryTitle ?? ""
                                        }
                                    />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>D4H Kind</FieldLabel>
                                    <FieldValue
                                        value={template.d4h?.kindTitle ?? ""}
                                    />
                                </Field>

                                <FieldSet>
                                    <FieldLegend>Output Format</FieldLegend>
                                    <Field orientation="responsive">
                                        <FieldLabel>Item Ref</FieldLabel>
                                        <FieldValue
                                            value={
                                                template.d4h?.outputRefFormat ??
                                                ""
                                            }
                                        />
                                    </Field>
                                </FieldSet>

                                <FieldSeparator />
                                <Field orientation="responsive">
                                    <FieldLabel>Status</FieldLabel>
                                    <FieldValue value={template.status} />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Created</FieldLabel>
                                    <FieldValue
                                        value={template.createdAt}
                                        format="dateWithDistance"
                                    />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Updated</FieldLabel>
                                    <FieldValue
                                        value={template.updatedAt}
                                        format="dateWithDistance"
                                    />
                                </Field>
                            </FieldGroup>
                        </CardContent>
                    </Card>
                    <I3Module_Template_Variants_List template={template} />
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
