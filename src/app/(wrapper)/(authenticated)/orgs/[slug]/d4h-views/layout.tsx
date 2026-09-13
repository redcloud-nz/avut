/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-views
 */

"use client";

import { useOrganization } from "@/hooks/use-organization";
import { NotEnabledError } from "@/lib/errors";

export default function D4HViews_Layout(props: LayoutProps<"/orgs/[slug]/d4h-views">) {
    const organization = useOrganization();

    if (!organization.isModuleEnabled("d4h-views")) {
        throw new NotEnabledError("The D4H Views module is not enabled for this organization.");
    }

    return props.children;
}
