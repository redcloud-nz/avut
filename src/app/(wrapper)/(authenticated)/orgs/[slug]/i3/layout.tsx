/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/i3
 */
"use client";

import { useOrganization } from "@/hooks/use-organization";
import { NotEnabledError } from "@/lib/errors";

export default function I3_Layout(props: LayoutProps<"/orgs/[slug]/i3">) {
    const organization = useOrganization();

    if (!organization.isModuleEnabled("i3")) {
        throw new NotEnabledError("The I3 module is not enabled for this organization.");
    }

    return props.children;
}
