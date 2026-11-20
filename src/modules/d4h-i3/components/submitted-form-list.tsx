/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { formatDistanceToNow } from "date-fns";
import type { Route } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { useSuspenseInfiniteQuery } from "@tanstack/react-query";

import { ItemLinkActionIcon } from "@/components/icons";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganization } from "@/hooks/use-organization";
import type { FormInstance, FormInstanceId } from "@/lib/schemas/form-instance";
import { formatItemCount } from "@/modules/d4h-i3/components/form-shared";
import { trpc } from "@/trpc/client";

export interface D4HI3Module_SubmittedFormList_Props {
    formKey: string;
    /** The `[instance_id]` page of one of these forms. */
    instanceHref: (instanceId: FormInstanceId) => Route;
    empty: { title: string; description: string };
}

/**
 * The caller's submitted forms of one kind (any status but Draft), newest first, with a
 * "Load more" button while older pages remain. Used by the Submitted tab of the Issue Items and
 * Return Items list pages.
 *
 * The page's `page.tsx` prefetches the first page with `prefetchInfinite` and the same input
 * (no `limit`) when this tab is active, so the keys match and this doesn't suspend on a cold
 * fetch.
 */
export function D4HI3Module_SubmittedFormList(props: D4HI3Module_SubmittedFormList_Props) {
    return (
        <Suspense fallback={<SubmittedFormListSkeleton />}>
            <SubmittedFormList {...props} />
        </Suspense>
    );
}

function SubmittedFormList({ formKey, instanceHref, empty }: D4HI3Module_SubmittedFormList_Props) {
    const organization = useOrganization();

    const { data, hasNextPage, fetchNextPage, isFetchingNextPage } = useSuspenseInfiniteQuery(
        trpc.forms.listSubmittedFormInstances.infiniteQueryOptions(
            { organizationId: organization.id, formKey },
            { getNextPageParam: (page) => page.nextCursor ?? undefined },
        ),
    );

    const instances = data.pages.flatMap((page) => page.items);

    if (instances.length === 0) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyTitle>{empty.title}</EmptyTitle>
                    <EmptyDescription>{empty.description}</EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    return (
        <>
            <ItemGroup>
                {instances.map((instance) => (
                    <SubmittedFormItem
                        key={instance.id}
                        instance={instance}
                        href={instanceHref(instance.id)}
                    />
                ))}
            </ItemGroup>
            {hasNextPage && (
                <div className="flex justify-center pt-2">
                    <Button
                        variant="outline"
                        aria-busy={isFetchingNextPage}
                        onClick={() => {
                            if (!isFetchingNextPage) void fetchNextPage();
                        }}
                    >
                        {isFetchingNextPage ? "Loading…" : "Load more"}
                    </Button>
                </div>
            )}
        </>
    );
}

/** The fields both the Issue and Return forms' data share, which is all this list shows. */
interface SubmittedFormData {
    recipient?: { name?: string };
    items?: unknown[];
}

function SubmittedFormItem({ instance, href }: { instance: FormInstance; href: Route }) {
    const formData = instance.formData as SubmittedFormData;

    return (
        <Item variant="outline" asChild>
            <Link href={href}>
                <ItemContent>
                    <ItemTitle>{formData.recipient?.name || "No one selected"}</ItemTitle>
                    {/* The relative time can tick over between SSR and hydration. */}
                    <ItemDescription suppressHydrationWarning>
                        {formatItemCount(formData.items?.length ?? 0)}
                        {", submitted "}
                        {formatDistanceToNow(new Date(instance.updatedAt), { addSuffix: true })}
                    </ItemDescription>
                </ItemContent>
                <ItemActions>
                    <ItemLinkActionIcon />
                </ItemActions>
            </Link>
        </Item>
    );
}

function SubmittedFormListSkeleton() {
    return (
        <div className="flex flex-col gap-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
        </div>
    );
}
