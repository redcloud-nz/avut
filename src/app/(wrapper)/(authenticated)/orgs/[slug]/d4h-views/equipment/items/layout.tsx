/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-views/equipment/items
 */
"use client";

import { ClientOnly } from "@/components/client-only";
import { PageLoadingSpinner } from "@/components/ui/loading";

/** These pages read TanStack DB collections, which only work in the browser. */
export default function D4HViews_EquipmentItems_Layout(
    props: LayoutProps<"/orgs/[slug]/d4h-views/equipment/items">,
) {
    return <ClientOnly fallback={<PageLoadingSpinner />}>{props.children}</ClientOnly>;
}
