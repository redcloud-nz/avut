/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-author
 */

import { getOrganizationBySlug } from "@/server/organization";
import { getOrganizationSettings } from "@/server/organization-settings";

export const metadata = {
    title: "Skill Package Author",
};

export default async function SkillPackageAuthorModule_Layout(
    props: LayoutProps<`/orgs/[slug]/skill-package-author`>,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);
    const settings = await getOrganizationSettings(organization.id);

    if (!settings.modules["skill-package-author"].enabled) {
        throw new Error(
            "Skill Package Author module is not enabled for this organization.",
        );
    }

    return props.children;
}
