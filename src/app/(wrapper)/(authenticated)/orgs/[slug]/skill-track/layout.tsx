/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track
 */

"use client";

import { useOrganization } from "@/hooks/use-organization";
import { NotEnabledError } from "@/lib/errors";

export default function SkillTrack_Layout(props: LayoutProps<"/orgs/[slug]/skill-track">) {
    const organization = useOrganization();

    if (!organization.isModuleEnabled("skill-track")) {
        throw new NotEnabledError("The Skill Track module is not enabled for this organization.");
    }

    return props.children;
}
