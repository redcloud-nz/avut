/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/notes
 */

import { Std } from "@/components/blocks/std";

import { requireOrganization } from "@/server/organization-access";

export default async function Notes_Index_Page(props: PageProps<"/orgs/[slug]/notes">) {
    const { slug } = await props.params;
    await requireOrganization(slug);

    return (
        <Std.SidebarInset>
            <Std.Navbar breadcrumbs={["Notes"]} />
            <Std.ScrollContainer>
                <div>Notes Module Index Page</div>
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
