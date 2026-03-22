/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/i3/forms/issue-items
 */

"use client";

import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Lexington } from "@/components/blocks/lexington";
import { Hermes } from "@/components/blocks/hermes";
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
} from "@/components/ui/items";

import { useOrganization } from "@/hooks/use-organization";
import { getFormInstancesCollection } from "@/lib/collections/form-instances";
import { FormInstance } from "@/lib/schemas/form-instance";
import { IssueItemsFormData } from "@/lib/schemas/i3-forms";

import { trpc } from "@/trpc/client";
import { Route } from "next";

export default function I3Module_Issue_FormInstanceList_Page() {
    const organization = useOrganization();
    const router = useRouter();
    const t = useTranslations("I3Module");

    const { data: instances } = useSuspenseQuery(
        trpc.forms.listFormInstances.queryOptions({
            organizationId: organization.id,
            formKey: "i3-issue",
            formStatus: "Draft",
        }),
    );

    function handleNewForm() {
        const newInstance = FormInstance.create({
            formKey: "i3-issue",
            formData: {
                recipient: { id: 0, name: "" },
                items: [],
                comments: "",
            },
            organizationId: organization.id,
        });
        const collection = getFormInstancesCollection(organization.id);
        collection.insert(newInstance);

        router.push(`/main/${organization.slug}/i3/forms/issue-items/${newInstance.id}` as Route);
    }

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    { label: t("title"), href: `/main/${organization.slug}/i3` },
                    { label: t("issue") },
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Header>
                        <Hermes.BackButton to={{ href: `/main/${organization.slug}/i3` }} />
                        <Hermes.Title>{t("IssueList.title")}</Hermes.Title>
                        <Hermes.Action>
                            <Button onClick={handleNewForm} variant="ghost" size="icon">
                                <ObjectIcons.Create />
                            </Button>
                        </Hermes.Action>
                        <Hermes.Description>
                            Your current draft "Issue Items" forms.
                        </Hermes.Description>
                    </Hermes.Header>
                    <Show
                        when={instances.length > 0}
                        fallback={
                            <Empty>
                                <EmptyHeader>
                                    <EmptyTitle>No Draft Forms</EmptyTitle>
                                    <EmptyDescription>
                                        You have not started an "Issue Items" form yet.
                                    </EmptyDescription>
                                </EmptyHeader>
                                <EmptyContent>
                                    <Button onClick={handleNewForm}>Start New Form</Button>
                                </EmptyContent>
                            </Empty>
                        }
                    >
                        <ItemGroup>
                            {instances.map((instance) => (
                                <Item key={instance.id} variant="outline" asChild>
                                    <Link
                                        href={
                                            `/main/${organization.slug}/i3/forms/issue-items/${instance.id}` as Route
                                        }
                                    >
                                        <ItemContent>
                                            <ItemTitle>
                                                {(instance.formData as IssueItemsFormData).recipient
                                                    ?.name || "No Recipient"}
                                            </ItemTitle>
                                            <ItemDescription>
                                                {
                                                    (instance.formData as IssueItemsFormData).items
                                                        .length
                                                }{" "}
                                                items - Updated{" "}
                                                {formatDistanceToNow(new Date(instance.updatedAt), {
                                                    addSuffix: true,
                                                })}
                                            </ItemDescription>
                                        </ItemContent>
                                        <ItemActions>
                                            <ItemLinkActionIcon />
                                        </ItemActions>
                                    </Link>
                                </Item>
                            ))}
                        </ItemGroup>
                    </Show>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
