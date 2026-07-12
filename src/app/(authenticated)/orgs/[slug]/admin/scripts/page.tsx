/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/admin/scripts
 */

import { Std } from "@/components/blocks/std";

import { getOrganizationBySlug } from "@/server/organization";

export default async function AdminScripts_Page(props: PageProps<`/orgs/[slug]/admin/scripts`>) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    return (
        <Std.SidebarInset>
            <Std.Navbar breadcrumbs={["Admin", "Scripts"]} />
            <Std.ScrollContainer>
                <Std.IndexPage title="Admin Scripts" />
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
