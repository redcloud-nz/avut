/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /teams/[slug]/skill-track
 */

"use client";

import { useOrganization } from "@/hooks/use-organization";
import { NotEnabledError } from "@/lib/errors";

export default function Team_SkillTrack_Layout(props: LayoutProps<"/teams/[slug]/skill-track">) {
    // The team layout provides the team's org, so this reads the org's `skill-track` setting.
    const organization = useOrganization();

    if (!organization.isModuleEnabled("skill-track")) {
        throw new NotEnabledError("The Skill Track module is not enabled for this organization.");
    }

    return props.children;
}
