/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/i3/forms/issue-items
 */

"use client";

import { formatDistanceToNow } from "date-fns";
import { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { newFormInstanceMutation } from "@/client/form-queries";
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
import { FormInstanceId } from "@/lib/schemas/form-instance";
import { I3IssueItemsFormData } from "@/lib/schemas/i3-forms";

import { I3IssueItemsForm } from "@/lib/forms";
import { trpc } from "@/trpc/client";

export default function I3Module_Issue_FormInstanceList_Page() {
    const organization = useOrganization();
    const router = useRouter();
    const t = useTranslations("I3Module");

    const { data: instances } = useSuspenseQuery(
        trpc.forms.listDraftFormInstances.queryOptions({
            organizationId: organization.id,
            formKey: I3IssueItemsForm.formKey,
        }),
    );

    const sortedInstances = [...instances]
        .filter((inst) => !inst.deleted)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    const newFormMutation = useMutation(
        newFormInstanceMutation({
            onMutate(data) {
                router.push(
                    `/main/${organization.slug}/i3/forms/issue-items/${data.formInstanceId}` as Route,
                );
            },
        }),
    );

    function handleNewForm() {
        const formInstanceId = FormInstanceId.create();
        newFormMutation.mutateAsync({
            formInstanceId,
            formKey: I3IssueItemsForm.formKey,
            organizationId: organization.id,
            formData: {
                recipient: { id: 0, name: "" },
                items: [],
                comments: "",
            },
        });
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
                        <Hermes.Title>{t("IssueList.title")}</Hermes.Title>
                        <Hermes.Action>
                            <Button onClick={handleNewForm} variant="outline">
                                <ObjectIcons.Create /> {t("IssueList.newFormButton")}
                            </Button>
                        </Hermes.Action>
                        <Hermes.Description>{t("IssueList.description")}</Hermes.Description>
                    </Hermes.Header>
                    <Show
                        when={sortedInstances.length > 0}
                        fallback={
                            <Empty>
                                <EmptyHeader>
                                    <EmptyTitle>{t("IssueList.emptyTitle")}</EmptyTitle>
                                    <EmptyDescription>
                                        {t("IssueList.emptyDescription")}
                                    </EmptyDescription>
                                </EmptyHeader>
                                <EmptyContent>
                                    <Button onClick={handleNewForm}>
                                        {t("IssueList.newFormButton")}
                                    </Button>
                                </EmptyContent>
                            </Empty>
                        }
                    >
                        <ItemGroup>
                            {sortedInstances.map((instance) => (
                                <Item key={instance.id} variant="outline" asChild>
                                    <Link
                                        href={
                                            `/main/${organization.slug}/i3/forms/issue-items/${instance.id}` as Route
                                        }
                                    >
                                        <ItemContent>
                                            <ItemTitle>
                                                {(instance.formData as I3IssueItemsFormData)
                                                    .recipient?.name ||
                                                    t("IssueList.itemTitle_noRecipient")}
                                            </ItemTitle>
                                            <ItemDescription>
                                                {t("IssueList.itemDescription", {
                                                    count: (
                                                        instance.formData as I3IssueItemsFormData
                                                    ).items.length,
                                                    updatedAt: formatDistanceToNow(
                                                        new Date(instance.updatedAt),
                                                        {
                                                            addSuffix: true,
                                                        },
                                                    ),
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
