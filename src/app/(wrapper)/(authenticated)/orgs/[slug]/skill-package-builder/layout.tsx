/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-builder
 */

"use client";

import { useOrganization } from "@/hooks/use-organization";
import { NotEnabledError } from "@/lib/errors";

export default function SkillPackageBuilder_Layout(
    props: LayoutProps<`/orgs/[slug]/skill-package-builder`>,
) {
    const organization = useOrganization();

    if (!organization.isModuleEnabled("skill-package-builder")) {
        throw new NotEnabledError(
            "The Skill Package Builder module is not enabled for this organization.",
        );
    }

    return props.children;
}
