/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useScopedRoute } from "@/hooks/use-scoped-route";
import { SkillPackageRef } from "@/lib/schemas/skill-package";

import { EntityLink } from "./entity-link";

export type SkillPackageLinkProps = {
    skillPackage: SkillPackageRef;
};

/** Links to the package's page in Skill Track's Packages, which subscribers and non-subscribers can both open. */
export function SkillPackageLink({ skillPackage }: SkillPackageLinkProps) {
    const scopedRoute = useScopedRoute();

    return (
        <EntityLink
            href={scopedRoute(
                {
                    organization: "/orgs/[slug]/skill-track/packages/[package_id]",
                    team: "/teams/[slug]/skill-track/packages/[package_id]",
                },
                { package_id: skillPackage.id },
            )}
            title={skillPackage.name}
            type="Skill Package"
        />
    );
}
