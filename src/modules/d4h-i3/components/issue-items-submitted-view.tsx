/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { HelpButton } from "@/components/docs/help-button";
import { Card, CardContent } from "@/components/ui/card";
import { FieldGroup, FieldSeparator } from "@/components/ui/field";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { I3IssueItemsFormData } from "@/forms/i3-issue-items/schema";
import { useOrganization } from "@/hooks/use-organization";
import { I3IssueItemsForm } from "@/lib/forms";
import { route } from "@/lib/routes";
import { FormInstanceId } from "@/lib/schemas/form-instance";
import {
    SubmittedAtFieldValue,
    SubmittedFormField,
    SubmittedFormHeader,
    UserNameFieldValue,
} from "@/modules/d4h-i3/components/form-shared";
import { trpc } from "@/trpc/client";

/**
 * A submitted Issue Items form, read-only: who the items went to, who recorded it, when it was
 * submitted, the items and any comments.
 */
export function D4HI3Module_IssueItems_SubmittedView({
    instanceId,
}: {
    instanceId: FormInstanceId;
}) {
    const organization = useOrganization();
    const slug = organization.slug;

    const { data: instance } = useSuspenseQuery(
        trpc.forms.getFormInstance.queryOptions({
            organizationId: organization.id,
            formKey: I3IssueItemsForm.formKey,
            formInstanceId: instanceId,
        }),
    );

    const formData = instance.formData as I3IssueItemsFormData;
    const recipientName = formData.recipient?.name || "No one selected";
    const items = formData.items ?? [];

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    { label: "D4H I3", href: route("/orgs/[slug]/d4h-i3", { slug }) },
                    { label: "Forms" },
                    {
                        label: "Issue Items",
                        href: `${route("/orgs/[slug]/d4h-i3/forms/issue-items", { slug })}?tab=submitted`,
                    },
                    { label: recipientName },
                ]}
                actions={<HelpButton id="d4h-i3/issue" />}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <SubmittedFormHeader title="Issue Items" />
                    <Card>
                        <CardContent>
                            <FieldGroup>
                                <div className="grid gap-5 sm:grid-cols-2">
                                    <SubmittedFormField label="Issued to">
                                        {recipientName}
                                    </SubmittedFormField>
                                    <SubmittedFormField label="Recorded by">
                                        <UserNameFieldValue />
                                    </SubmittedFormField>
                                    <SubmittedFormField label="Submitted">
                                        <SubmittedAtFieldValue date={instance.updatedAt} />
                                    </SubmittedFormField>
                                </div>

                                <FieldSeparator />

                                <SubmittedFormField label="Issued Items">
                                    <ItemGroup>
                                        {items.map((item, index) => (
                                            <Item size="sm" key={index}>
                                                <ItemContent>
                                                    <ItemTitle>{item.template.name}</ItemTitle>
                                                    <ItemDescription>
                                                        {[
                                                            item.variant?.name,
                                                            item.serialNumber
                                                                ? `S/N: ${item.serialNumber}`
                                                                : null,
                                                        ]
                                                            .filter(Boolean)
                                                            .join(" - ") || "—"}
                                                    </ItemDescription>
                                                </ItemContent>
                                            </Item>
                                        ))}
                                    </ItemGroup>
                                </SubmittedFormField>

                                {formData.comments && (
                                    <>
                                        <FieldSeparator />
                                        <SubmittedFormField label="Comments">
                                            <p className="whitespace-pre-wrap">
                                                {formData.comments}
                                            </p>
                                        </SubmittedFormField>
                                    </>
                                )}
                            </FieldGroup>
                        </CardContent>
                    </Card>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
