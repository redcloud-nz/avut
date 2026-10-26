/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { newFormInstanceMutation } from "@/client/form-queries";
import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { HelpButton } from "@/components/docs/help-button";
import { ItemLinkActionIcon, ObjectIcons } from "@/components/icons";
import { Show } from "@/components/show";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import { I3ReturnItemsFormData } from "@/forms/i3-return-items/schema";
import { useOrganization } from "@/hooks/use-organization";
import { I3ReturnItemsForm } from "@/lib/forms";
import { route } from "@/lib/routes";
import { FormInstanceId } from "@/lib/schemas/form-instance";
import { trpc } from "@/trpc/client";

export function D4HI3Module_ReturnItems_FormInstanceList() {
    const organization = useOrganization();
    const router = useRouter();

    const { data: instances } = useSuspenseQuery(
        trpc.forms.listDraftFormInstances.queryOptions({
            organizationId: organization.id,
            formKey: I3ReturnItemsForm.formKey,
        }),
    );

    // Held from the click until the new draft's page has rendered, which is well after the save.
    const [isOpening, startOpening] = useTransition();

    const newFormMutation = useMutation(
        newFormInstanceMutation({
            // Navigate only once the draft is saved: the form page fetches it server-side
            // and 404s if it isn't there yet.
            onSuccess(_result, data) {
                startOpening(() =>
                    router.push(
                        route("/orgs/[slug]/d4h-i3/forms/return-items/[instance_id]", {
                            slug: organization.slug,
                            instance_id: data.formInstanceId,
                        }),
                    ),
                );
            },
        }),
    );

    // The draft being opened is cached from its save. Keep it out of the list while its page
    // opens, so the click doesn't read as only adding a row.
    const openingId = newFormMutation.variables?.formInstanceId;
    const sortedInstances = [...instances]
        .filter((inst) => !inst.deleted && inst.id !== openingId)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    function handleNewForm() {
        const formInstanceId = FormInstanceId.create();
        newFormMutation.mutate({
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
                actions={<HelpButton id="d4h-i3/return" />}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Return Items</Saratoga.Title>
                        <Saratoga.Actions>
                            <Button
                                onClick={handleNewForm}
                                variant="outline"
                                disabled={newFormMutation.isPending || isOpening}
                            >
                                {newFormMutation.isPending || isOpening ? (
                                    <Spinner />
                                ) : (
                                    <ObjectIcons.Create />
                                )}{" "}
                                New
                            </Button>
                        </Saratoga.Actions>
                    </Saratoga.Header>
                    <Show
                        when={sortedInstances.length > 0}
                        fallback={
                            <Empty>
                                <EmptyHeader>
                                    <EmptyTitle>No Draft Forms</EmptyTitle>
                                    <EmptyDescription>Click New to start a form.</EmptyDescription>
                                </EmptyHeader>
                            </Empty>
                        }
                    >
                        <p className="text-sm text-muted-foreground">
                            Your draft forms are listed below. Click a form to continue editing, or
                            New to start another.
                        </p>
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
