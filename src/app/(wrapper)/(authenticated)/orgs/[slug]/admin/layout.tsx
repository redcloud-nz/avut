/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/admin
 */

"use client";

import { useOrganization } from "@/hooks/use-organization";
import { NotEnabledError } from "@/lib/errors";

export default function Admin_Layout(props: LayoutProps<"/orgs/[slug]/admin">) {
    const organization = useOrganization();

    if (!organization.isModuleEnabled("admin")) {
        throw new NotEnabledError("The Admin module is not enabled for this organization.");
    }

    return props.children;
}
