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
    FieldGroup,
    FieldLabel,
    FieldSeparator,
} from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";
import { Link } from "@/components/ui/link";

import { useOrganization } from "@/hooks/use-organization";
import { useD4hPpeTemplate } from "@/hooks/use-d4h-ppe-template";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

import { D4hPPEModule_DeleteTemplate_Dialog } from "./delete-template";
import { D4hPPEModule_Template_Models_List } from "./template-models";

export default function D4hPPEModule_Template_Page(
    props: PageProps<"/orgs/[slug]/d4h-ppe/templates/[template_id]">,
) {
    const { slug, template_id } = use(props.params);
    const organization = useOrganization();
    const template = useD4hPpeTemplate(template_id);

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    const { data: categories } = useQuery(
        trpc.d4hApi.listEquipmentCategories.queryOptions({
            organizationId: organization.id,
        }),
    );

    const { data: kinds } = useQuery(
        trpc.d4hApi.listEquipmentKinds.queryOptions({
            organizationId: organization.id,
        }),
    );

    const category = categories?.find((c) => c.id === template.d4hCategoryId);
    const kind = kinds?.find((k) => k.id === template.d4hKindId);

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).d4HPpe.index,
                    Paths.org(slug).d4HPpe.templates,
                    template.name,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Header>
                        <Hermes.BackButton
                            to={Paths.org(slug).d4HPpe.templates}
                            tooltip="Back to templates"
                        />
                        <Hermes.Title>{template.name}</Hermes.Title>
                    </Hermes.Header>
                    <Card>
                        <CardHeader>
                            <CardTitle>Template Details</CardTitle>
                            <CardAction className="flex gap-2">
                                <Protect
                                    orgId={organization.id}
                                    permissions={{ d4hPpeTemplate: ["update"] }}
                                >
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        tooltip="Edit template"
                                        asChild
                                    >
                                        <Link
                                            to={
                                                Paths.org(slug).d4HPpe.template(
                                                    template.id,
                                                ).update
                                            }
                                        >
                                            <ObjectIcons.Edit />
                                        </Link>
                                    </Button>
                                </Protect>
                                <Protect
                                    orgId={organization.id}
                                    permissions={{ d4hPpeTemplate: ["delete"] }}
                                >
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        tooltip="Delete template"
                                        onClick={() =>
                                            setDeleteDialogOpen(true)
                                        }
                                    >
                                        <ObjectIcons.Delete />
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
                                <Field orientation="responsive">
                                    <FieldLabel>Description</FieldLabel>
                                    <FieldValue value={template.description} />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Status</FieldLabel>
                                    <FieldValue value={template.status} />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>D4H Category</FieldLabel>
                                    <FieldValue
                                        value={
                                            category?.title ??
                                            `ID: ${template.d4hCategoryId}`
                                        }
                                    />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>D4H Kind</FieldLabel>
                                    <FieldValue
                                        value={
                                            kind?.title ??
                                            `ID: ${template.d4hKindId}`
                                        }
                                    />
                                </Field>
                                <FieldSeparator />
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
                    <D4hPPEModule_Template_Models_List
                        templateId={template.id}
                    />
                </Lexington.Column>
            </Lexington.Page>

            <D4hPPEModule_DeleteTemplate_Dialog
                template={template}
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
            />
        </Lexington.Root>
    );
}
