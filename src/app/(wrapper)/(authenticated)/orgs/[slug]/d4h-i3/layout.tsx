/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-i3
 */
"use client";

import { useOrganization } from "@/hooks/use-organization";
import { NotEnabledError } from "@/lib/errors";

export default function I3_Layout(props: LayoutProps<"/orgs/[slug]/d4h-i3">) {
    const organization = useOrganization();

    if (!organization.isModuleEnabled("d4h-i3")) {
        throw new NotEnabledError(
            "The D4H I3 module is not enabled for this organization. It needs the D4H module turned on too.",
        );
    }

    return props.children;
}
