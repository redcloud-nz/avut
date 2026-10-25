/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { SkillPackageRef } from "@/lib/schemas/skill-package";

import { EntityLink } from "./entity-link";

export type SkillPackageLinkProps = {
    skillPackage: SkillPackageRef;
};

/** Links to the package's page in Skill Track's Packages, which subscribers and non-subscribers can both open. */
export function SkillPackageLink({ skillPackage }: SkillPackageLinkProps) {
    const organization = useOrganization();

    return (
        <EntityLink
            href={route("/orgs/[slug]/skill-track/packages/[package_id]", {
                slug: organization.slug,
                package_id: skillPackage.id,
            })}
            title={skillPackage.name}
            type="Skill Package"
        />
    );
}
