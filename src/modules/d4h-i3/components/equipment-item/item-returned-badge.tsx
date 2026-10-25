/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { useOrganization } from "@/hooks/use-organization";
import { trpc } from "@/trpc/client";

import { D4HI3Module_ReturnedBadge } from "../returned-badge";

/**
 * The Returned badge for the D4H item page, passed in as a slot by its `page.tsx`. Renders nothing
 * unless the item has an open retire task.
 */
export function D4HI3Module_ItemReturnedBadge({
    teamId,
    itemId,
}: {
    teamId: number;
    itemId: number;
}) {
    const organization = useOrganization();

    const { data: returnedItemIds } = useSuspenseQuery(
        trpc.d4hTasks.listReturnedItemIds.queryOptions({
            organizationId: organization.id,
            teamId,
        }),
    );

    return returnedItemIds.includes(itemId) ? <D4HI3Module_ReturnedBadge /> : null;
}
