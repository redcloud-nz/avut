/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/d4h-views
 */

import { getOrganizationBySlug } from "@/server/organization";
import { getOrganizationSettings } from "@/server/organization-settings";

export default async function D4HViews_Layout(
    props: LayoutProps<"/main/[slug]/d4h-views">,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);
    const settings = await getOrganizationSettings(organization.id);

    if (settings.modules["d4h-views"].enabled === false)
        throw new Error(
            "D4H Views module is not enabled for this organization.",
        );

    return props.children;
}
