/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { newFormInstanceMutation } from "@/client/form-queries";
import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { ItemLinkActionIcon, ObjectIcons } from "@/components/icons";
import { Show } from "@/components/show";
import { Button } from "@/components/ui/button";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from "@/components/ui/empty";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/ui/item";
import { I3ReturnItemsFormData } from "@/forms/i3-return-items/schema";
import { useOrganization } from "@/hooks/use-organization";
import { I3ReturnItemsForm } from "@/lib/forms";
import { route } from "@/lib/routes";
import { FormInstanceId } from "@/lib/schemas/form-instance";
import { trpc } from "@/trpc/client";

export function I3Module_ReturnItems_FormInstanceList() {
    const organization = useOrganization();
    const router = useRouter();

    const { data: instances } = useSuspenseQuery(
        trpc.forms.listDraftFormInstances.queryOptions({
            organizationId: organization.id,
            formKey: I3ReturnItemsForm.formKey,
        }),
    );

    const sortedInstances = [...instances]
        .filter((inst) => !inst.deleted)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    const newFormMutation = useMutation(
        newFormInstanceMutation({
            // Navigate only once the draft is saved: the form page fetches it server-side
            // and 404s if it isn't there yet.
            onSuccess(_result, data) {
                router.push(
                    route("/orgs/[slug]/d4h-i3/forms/return-items/[instance_id]", {
                        slug: organization.slug,
                        instance_id: data.formInstanceId,
                    }),
                );
            },
        }),
    );

    function handleNewForm() {
        const formInstanceId = FormInstanceId.create();
        newFormMutation.mutateAsync({
            formInstanceId,
            formKey: I3ReturnItemsForm.formKey,
            organizationId: organization.id,
            formData: {
                recipient: { id: 0, teamId: 0, name: "" },
                items: [],
                comments: "",
            },
        });
    }

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    {
                        label: "D4H I3",
                        href: route("/orgs/[slug]/d4h-i3", { slug: organization.slug }),
                    },
                    { label: "Forms" },
                    { label: "Return Items" },
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Return Items</Saratoga.Title>
                        <Saratoga.Actions>
                            <Button onClick={handleNewForm} variant="outline">
                                <ObjectIcons.Create /> New
                            </Button>
                        </Saratoga.Actions>
                    </Saratoga.Header>
                    <p className="text-sm text-muted-foreground">
                        Your current draft forms are listed below. Click on a form to continue
                        editing, or create a new form to return items.
                    </p>
                    <Show
                        when={sortedInstances.length > 0}
                        fallback={
                            <Empty>
                                <EmptyHeader>
                                    <EmptyTitle>No Draft Forms</EmptyTitle>
                                    <EmptyDescription>
                                        You currently have no draft forms. Click the button below to
                                        create a new form.
                                    </EmptyDescription>
                                </EmptyHeader>
                                <EmptyContent>
                                    <Button onClick={handleNewForm}>New Form</Button>
                                </EmptyContent>
                            </Empty>
                        }
                    >
                        <ItemGroup>
                            {sortedInstances.map((instance) => {
                                const itemCount = (instance.formData as I3ReturnItemsFormData).items
                                    .length;
                                return (
                                    <Item key={instance.id} variant="outline" asChild>
                                        <Link
                                            href={route(
                                                "/orgs/[slug]/d4h-i3/forms/return-items/[instance_id]",
                                                {
                                                    slug: organization.slug,
                                                    instance_id: instance.id,
                                                },
                                            )}
                                        >
                                            <ItemContent>
                                                <ItemTitle>
                                                    {(instance.formData as I3ReturnItemsFormData)
                                                        .recipient?.name || "No one selected"}
                                                </ItemTitle>
                                                {/* The relative time can tick over between SSR and hydration. */}
                                                <ItemDescription suppressHydrationWarning>
                                                    {itemCount === 0
                                                        ? "No items"
                                                        : itemCount === 1
                                                          ? "1 item"
                                                          : `${itemCount} items`}
                                                    {", updated "}
                                                    {formatDistanceToNow(
                                                        new Date(instance.updatedAt),
                                                        {
                                                            addSuffix: true,
                                                        },
                                                    )}
                                                </ItemDescription>
                                            </ItemContent>
                                            <ItemActions>
                                                <ItemLinkActionIcon />
                                            </ItemActions>
                                        </Link>
                                    </Item>
                                );
                            })}
                        </ItemGroup>
                    </Show>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
