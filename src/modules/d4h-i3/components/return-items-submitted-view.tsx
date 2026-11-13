/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { Suspense } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { D4HItemRef } from "@/components/d4h/d4h-item-ref";
import { HelpButton } from "@/components/docs/help-button";
import { Protect } from "@/components/protect";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup, FieldSeparator } from "@/components/ui/field";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { I3ReturnItemsFormData } from "@/forms/i3-return-items/schema";
import { useOrganization } from "@/hooks/use-organization";
import { I3ReturnItemsForm } from "@/lib/forms";
import { route } from "@/lib/routes";
import { D4HTaskStatus } from "@/lib/schemas/d4h-task";
import { FormInstanceId } from "@/lib/schemas/form-instance";
import { OrganizationId } from "@/lib/schemas/organization";
import {
    SubmittedAtFieldValue,
    SubmittedFormField,
    SubmittedFormHeader,
    UserNameFieldValue,
} from "@/modules/d4h-i3/components/form-shared";
import { trpc } from "@/trpc/client";

/**
 * A submitted Return Items form, read-only: who returned the items, who recorded it, when it was
 * submitted, the items and any comments, then the D4H tasks it queued and where they stand.
 */
export function D4HI3Module_ReturnItems_SubmittedView({
    instanceId,
}: {
    instanceId: FormInstanceId;
}) {
    const organization = useOrganization();
    const slug = organization.slug;

    const { data: instance } = useSuspenseQuery(
        trpc.forms.getFormInstance.queryOptions({
            organizationId: organization.id,
            formKey: I3ReturnItemsForm.formKey,
            formInstanceId: instanceId,
        }),
    );

    const formData = instance.formData as Partial<I3ReturnItemsFormData>;
    const recipientName = formData.recipient?.name || "No one selected";
    const items = formData.items ?? [];

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    { label: "D4H I3", href: route("/orgs/[slug]/d4h-i3", { slug }) },
                    { label: "Forms" },
                    {
                        label: "Return Items",
                        href: `${route("/orgs/[slug]/d4h-i3/forms/return-items", { slug })}?tab=submitted`,
                    },
                    { label: recipientName },
                ]}
                actions={<HelpButton id="d4h-i3/return" />}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <SubmittedFormHeader title="Return Items" />
                    <Card>
                        <CardContent>
                            <FieldGroup>
                                <div className="grid gap-5 sm:grid-cols-2">
                                    <SubmittedFormField label="Returned by">
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

                                <SubmittedFormField label="Returned Items">
                                    <ItemGroup>
                                        {items.map((item) => (
                                            <Item size="sm" key={item.itemId}>
                                                <ItemContent>
                                                    <ItemTitle>
                                                        <D4HItemRef value={item.ref} />{" "}
                                                        {item.kindTitle}
                                                    </ItemTitle>
                                                </ItemContent>
                                                {/* Only a processed Return has queued its tasks. */}
                                                {instance.formStatus === "Processed" && (
                                                    <Protect permissions={{ d4hTask: ["view"] }}>
                                                        {/* Only the mark waits on the tasks, not the item. */}
                                                        <Suspense fallback={null}>
                                                            <NotReturnedMark
                                                                organizationId={organization.id}
                                                                instanceId={instanceId}
                                                                itemId={item.itemId}
                                                            />
                                                        </Suspense>
                                                    </Protect>
                                                )}
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

                    <Protect permissions={{ d4hTask: ["view"] }}>
                        <Card>
                            <CardHeader>
                                <CardTitle>D4H Tasks</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Suspense fallback={<Skeleton className="h-16 w-full" />}>
                                    <FormInstanceTasks
                                        organizationId={organization.id}
                                        instanceId={instanceId}
                                    />
                                </Suspense>
                            </CardContent>
                        </Card>
                    </Protect>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}

function formInstanceTasksQuery(organizationId: OrganizationId, instanceId: FormInstanceId) {
    return trpc.forms.listFormInstanceTasks.queryOptions({
        organizationId,
        formInstanceId: instanceId,
    });
}

/**
 * "Not returned" on an item the Return queued no task for. A Return is processed once any item
 * was returned, so an item that failed stays on the form without a task.
 */
function NotReturnedMark({
    organizationId,
    instanceId,
    itemId,
}: {
    organizationId: OrganizationId;
    instanceId: FormInstanceId;
    itemId: number;
}) {
    const { data: tasks } = useSuspenseQuery(formInstanceTasksQuery(organizationId, instanceId));

    if (tasks.some((task) => task.resourceId === itemId)) return null;

    return (
        <ItemActions>
            <Badge variant="destructive">Not returned</Badge>
        </ItemActions>
    );
}

/** The D4H tasks a Return queued: each task's item, kind and current status. */
function FormInstanceTasks({
    organizationId,
    instanceId,
}: {
    organizationId: OrganizationId;
    instanceId: FormInstanceId;
}) {
    const { data: tasks } = useSuspenseQuery(formInstanceTasksQuery(organizationId, instanceId));

    if (tasks.length === 0) {
        return <p className="text-sm text-muted-foreground">No D4H tasks were queued.</p>;
    }

    return (
        <ItemGroup>
            {tasks.map((task) => (
                <Item variant="outline" size="sm" key={task.id}>
                    <ItemContent>
                        <ItemTitle>{task.itemLabel}</ItemTitle>
                        <ItemDescription>{task.kind}</ItemDescription>
                    </ItemContent>
                    <ItemActions>
                        <Badge variant={taskStatusBadgeVariant(task.status)}>{task.status}</Badge>
                    </ItemActions>
                </Item>
            ))}
        </ItemGroup>
    );
}

function taskStatusBadgeVariant(status: D4HTaskStatus) {
    switch (status) {
        case "Open":
            return "default";
        case "Done":
            return "secondary";
        case "Dismissed":
            return "outline";
    }
}
