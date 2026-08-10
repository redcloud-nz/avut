/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/notes
 */

import { ModuleSidebar } from "@/components/nav/module-sidebar";

import { getOrganizationBySlug } from "@/server/organization";
import { getOrganizationSettings } from "@/server/organization-settings";

export const metadata = {
    title: "Notes",
};

export default async function Notes_Layout(props: LayoutProps<`/orgs/[slug]/notes`>) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);
    const settings = await getOrganizationSettings(organization.id);

    if (!settings.modules.notes.enabled) {
        throw new Error("Notes module is not enabled for this organization.");
    }

    return <ModuleSidebar scope="organization">{props.children}</ModuleSidebar>;
}
