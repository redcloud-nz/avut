/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h
 */

"use client";

import { useOrganization } from "@/hooks/use-organization";
import { NotEnabledError } from "@/lib/errors";

export default function D4HViews_Layout(props: LayoutProps<"/orgs/[slug]/d4h">) {
    const organization = useOrganization();

    if (!organization.isModuleEnabled("d4h")) {
        throw new NotEnabledError("The D4H module is not enabled for this organization.");
    }

    return props.children;
}
