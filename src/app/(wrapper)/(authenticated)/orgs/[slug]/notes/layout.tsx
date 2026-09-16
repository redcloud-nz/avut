/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/notes
 */

"use client";

import { useOrganization } from "@/hooks/use-organization";
import { NotEnabledError } from "@/lib/errors";

export default function Notes_Layout(props: LayoutProps<"/orgs/[slug]/notes">) {
    const organization = useOrganization();

    if (!organization.isModuleEnabled("notes")) {
        throw new NotEnabledError("The Notes module is not enabled for this organization.");
    }

    return props.children;
}
