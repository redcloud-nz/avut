/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-builder
 */

import { getOrganizationBySlug } from "@/server/organization";
import { getOrganizationSettings } from "@/server/organization-settings";

export const metadata = {
    title: "Skill Package Builder",
};

export default async function SkillPackageBuilder_Layout(
    props: LayoutProps<`/orgs/[slug]/skill-package-builder`>,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);
    const settings = await getOrganizationSettings(organization.id);

    if (!settings.modules["skill-package-builder"].enabled) {
        throw new Error(
            "Skill Package Builder module is not enabled for this organization.",
        );
    }

    return props.children;
}
